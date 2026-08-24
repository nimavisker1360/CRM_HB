import "server-only";
import { logActivity } from "@/lib/activity";
import { assertCanAccessScopedRecord, stringifyId, type AgentScope } from "@/lib/auth/agent-scope";
import type { SessionUser } from "@/lib/auth/session";
import { getPagination, objectIdOrUndefined, paginationMeta } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { Agent, Customer, FollowUp, Property, PropertyMatch, WhatsAppMessage } from "@/models";
import { createAdminNotification, createAgentNotification } from "@/services/notifications/notification.service";
import {
  getWhatsAppConfigurationIssues,
  isWhatsAppRecipientAllowed,
  publicWhatsAppConfiguration,
  whatsappConfig,
} from "@/services/whatsapp/whatsapp.config";
import { normalizeWhatsAppPhone } from "@/services/whatsapp/whatsapp.normalizer";
import { MetaWhatsAppProvider } from "@/services/whatsapp/whatsapp.provider";
import {
  buildFollowUpPreview,
  buildMatchPreview,
  buildPropertyPreview,
} from "@/services/whatsapp/whatsapp.templates";
import type { SendWhatsAppInput } from "@/services/whatsapp/whatsapp.types";
import { WhatsAppServiceError } from "@/services/whatsapp/whatsapp.types";
import { assertCanAccessMessage } from "@/services/whatsapp/whatsapp.access";

type RecordLike = Record<string, unknown> & { _id: unknown };

function isDuplicateKeyError(error: unknown) {
  return error instanceof Error && error.message.includes("duplicate key");
}

function validClientRequestId(value: string) {
  return /^[a-zA-Z0-9:_-]{12,128}$/.test(value);
}

function dayStart() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

async function ensureRateLimit(agentId: string | undefined, userId: string) {
  const actorQuery = agentId ? { agentId: objectIdOrUndefined(agentId) } : { createdBy: objectIdOrUndefined(userId) };
  const count = await WhatsAppMessage.countDocuments({
    ...actorQuery,
    createdAt: { $gte: dayStart() },
    direction: "OUTBOUND",
  });
  if (count >= whatsappConfig.maxMessagesPerAgentPerDay) {
    throw new WhatsAppServiceError(
      "WHATSAPP_DAILY_LIMIT",
      "سقف روزانه پیام‌های آزمایشی این کاربر تکمیل شده است.",
      429,
    );
  }
}

async function createFailureNotification(message: RecordLike, agentId?: string) {
  const common = {
    actionUrl: `/whatsapp/${String(message._id)}`,
    category: "SYSTEM" as const,
    customerId: message.customerId as string,
    deduplicationKey: `whatsapp:failed:${String(message._id)}`,
    entityId: message.customerId as string,
    entityType: "CUSTOMER" as const,
    message: "ارسال پیام واتساپ ناموفق بود.",
    priority: "HIGH" as const,
    title: "خطا در ارسال WhatsApp",
    type: "SYSTEM" as const,
  };
  if (agentId) return createAgentNotification({ ...common, recipientAgentId: agentId });
  return createAdminNotification(common);
}

async function recordRejectedAttempt(input: SendWhatsAppInput, session: SessionUser, customer: RecordLike, agentId: string | undefined, recipient: string, error: WhatsAppServiceError) {
  const isTemplate = input.messageType === "TEMPLATE";
  try {
    const message = (await WhatsAppMessage.create({
      agentId: objectIdOrUndefined(agentId),
      clientRequestId: input.clientRequestId,
      createdBy: objectIdOrUndefined(session.userId),
      customerId: customer._id,
      direction: "OUTBOUND",
      errorCode: error.providerCode || error.code,
      errorMessage: error.publicMessage,
      failedAt: new Date(),
      followUpId: objectIdOrUndefined(input.followUpId),
      matchId: objectIdOrUndefined(input.matchId),
      messageType: input.messageType,
      propertyId: objectIdOrUndefined(input.propertyId),
      provider: "META_CLOUD_API",
      recipientPhone: recipient.replace(/\D/g, "").slice(0, 15) || "INVALID",
      senderPhoneNumberId: whatsappConfig.phoneNumberId,
      status: "FAILED",
      templateLanguage: isTemplate ? input.language || whatsappConfig.templateLanguage : undefined,
      templateName: isTemplate ? input.templateName || whatsappConfig.testTemplateName : undefined,
      text: input.text?.trim() || undefined,
    })).toObject() as RecordLike;
    await createFailureNotification(message, agentId).catch((notificationError) =>
      console.error("[whatsapp:rejected-notification]", notificationError),
    );
  } catch (recordError) {
    if (!isDuplicateKeyError(recordError)) throw recordError;
  }
}

async function resolveRelatedRecords(input: SendWhatsAppInput, customer: RecordLike, agent?: RecordLike) {
  let property: RecordLike | null = null;
  let match: RecordLike | null = null;
  let followUp: RecordLike | null = null;

  if (input.matchId) {
    const matchId = objectIdOrUndefined(input.matchId);
    if (!matchId) throw new WhatsAppServiceError("INVALID_MATCH", "تطبیق انتخاب‌شده معتبر نیست.", 422);
    match = await PropertyMatch.findById(matchId).lean<RecordLike | null>();
    if (!match || stringifyId(match.customerId) !== String(customer._id)) {
      throw new WhatsAppServiceError("INVALID_MATCH", "این تطبیق متعلق به مشتری انتخاب‌شده نیست.", 422);
    }
    input.propertyId ||= stringifyId(match.propertyId);
  }

  if (input.propertyId) {
    const propertyId = objectIdOrUndefined(input.propertyId);
    if (!propertyId) throw new WhatsAppServiceError("INVALID_PROPERTY", "ملک انتخاب‌شده معتبر نیست.", 422);
    property = await Property.findById(propertyId).lean<RecordLike | null>();
    if (!property) throw new WhatsAppServiceError("INVALID_PROPERTY", "ملک انتخاب‌شده پیدا نشد.", 404);
  }

  if (input.followUpId) {
    const followUpId = objectIdOrUndefined(input.followUpId);
    if (!followUpId) throw new WhatsAppServiceError("INVALID_FOLLOWUP", "پیگیری انتخاب‌شده معتبر نیست.", 422);
    followUp = await FollowUp.findById(followUpId).lean<RecordLike | null>();
    const followUpCustomerId = stringifyId(followUp?.customerId) || stringifyId(followUp?.customer);
    if (!followUp || followUpCustomerId !== String(customer._id)) {
      throw new WhatsAppServiceError("INVALID_FOLLOWUP", "این پیگیری متعلق به مشتری انتخاب‌شده نیست.", 422);
    }
  }

  if (input.messageType === "PROPERTY" && !property) {
    throw new WhatsAppServiceError("PROPERTY_REQUIRED", "برای پیام معرفی ملک باید یک ملک انتخاب شود.", 422);
  }
  if (input.messageType === "MATCH" && (!match || !property)) {
    throw new WhatsAppServiceError("MATCH_REQUIRED", "برای پیام تطبیق باید یک تطبیق معتبر انتخاب شود.", 422);
  }
  if (input.messageType === "FOLLOWUP" && !followUp) {
    throw new WhatsAppServiceError("FOLLOWUP_REQUIRED", "برای پیام پیگیری باید یک پیگیری معتبر انتخاب شود.", 422);
  }

  let preview = input.text?.trim() || "";
  const previewCustomer = { fullName: customer.fullName };
  const previewAgent = agent ? { fullName: agent.fullName, name: agent.name } : undefined;
  const previewProperty = property ? {
    city: property.city,
    currency: property.currency,
    district: property.district,
    grossArea: property.grossArea,
    price: property.price,
    rooms: property.rooms,
    title: property.title,
  } : null;
  if (input.messageType === "MATCH" && match && previewProperty) {
    preview = buildMatchPreview(previewCustomer, previewProperty, match.score, previewAgent);
  } else if (input.messageType === "PROPERTY" && previewProperty) {
    preview = buildPropertyPreview(previewCustomer, previewProperty, previewAgent);
  } else if (input.messageType === "FOLLOWUP" && followUp) {
    preview = buildFollowUpPreview(previewCustomer, followUp.note || followUp.notes, previewAgent);
  }

  const media = property && (input.messageType === "PROPERTY" || input.messageType === "MATCH")
    ? [
        ...(Array.isArray(property.images) ? property.images.slice(0, 10).map((url) => ({ type: "image" as const, url: String(url) })) : []),
        ...(property.videoUrl ? [{ type: "video" as const, url: String(property.videoUrl) }] : []),
      ].filter((item) => {
        try {
          return new URL(item.url).protocol === "https:";
        } catch {
          return false;
        }
      })
    : [];

  return { followUp, match, media, preview, property };
}

export async function sendWhatsAppMessage(input: SendWhatsAppInput, session: SessionUser) {
  await connectToDatabase();
  if (!validClientRequestId(input.clientRequestId)) {
    throw new WhatsAppServiceError("INVALID_REQUEST_ID", "شناسه یکتای درخواست معتبر نیست.", 422);
  }

  const existing = await WhatsAppMessage.findOne({ clientRequestId: input.clientRequestId }).lean<RecordLike | null>();
  if (existing) {
    assertCanAccessMessage(session, existing);
    return { deduplicated: true, message: serializeMongo(existing) };
  }

  const customerId = objectIdOrUndefined(input.customerId);
  if (!customerId) throw new WhatsAppServiceError("INVALID_CUSTOMER", "مشتری انتخاب‌شده معتبر نیست.", 422);
  const customer = await Customer.findById(customerId).lean<RecordLike | null>();
  if (!customer) throw new WhatsAppServiceError("CUSTOMER_NOT_FOUND", "مشتری پیدا نشد.", 404);
  assertCanAccessScopedRecord(session, customer);

  const agentId = stringifyId(customer.assignedAgentId) || stringifyId(customer.assignedAgent);
  const agent = agentId ? await Agent.findById(agentId).lean<RecordLike | null>() : null;
  const rawPhone = String(customer.whatsapp || customer.phone || "");
  const recipientPhone = normalizeWhatsAppPhone(rawPhone);
  if (!recipientPhone) {
    const error = new WhatsAppServiceError("WHATSAPP_INVALID_PHONE", "شماره واتساپ مشتری معتبر نیست و کد کشور نباید حدس زده شود.", 422);
    await recordRejectedAttempt(input, session, customer, agentId, rawPhone, error);
    throw error;
  }
  if (!isWhatsAppRecipientAllowed(recipientPhone)) {
    const error = new WhatsAppServiceError(
      "WHATSAPP_TEST_RECIPIENT_BLOCKED",
      "این شماره در فهرست گیرندگان آزمایشی Meta قرار ندارد.",
      422,
    );
    await recordRejectedAttempt(input, session, customer, agentId, recipientPhone, error);
    throw error;
  }

  const issues = getWhatsAppConfigurationIssues();
  if (issues.length) {
    const error = new WhatsAppServiceError("WHATSAPP_NOT_CONFIGURED", "تنظیمات آزمایشی WhatsApp کامل نیست.", 503);
    await recordRejectedAttempt(input, session, customer, agentId, recipientPhone, error);
    throw error;
  }
  try {
    await ensureRateLimit(agentId, session.userId);
  } catch (error) {
    if (error instanceof WhatsAppServiceError) {
      await recordRejectedAttempt(input, session, customer, agentId, recipientPhone, error);
    }
    throw error;
  }

  let related: Awaited<ReturnType<typeof resolveRelatedRecords>>;
  try {
    related = await resolveRelatedRecords(input, customer, agent || undefined);
  } catch (error) {
    if (error instanceof WhatsAppServiceError) {
      await recordRejectedAttempt(input, session, customer, agentId, recipientPhone, error);
    }
    throw error;
  }
  const isTemplate = input.messageType === "TEMPLATE";
  if (!isTemplate) {
    const conversationStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hasOpenConversation = await WhatsAppMessage.exists({
      customerId,
      direction: "INBOUND",
      lastInboundAt: { $gte: conversationStart },
    });
    if (!hasOpenConversation) {
      const error = new WhatsAppServiceError(
        related.media.length ? "WHATSAPP_MEDIA_WINDOW_REQUIRED" : "WHATSAPP_CONVERSATION_WINDOW_REQUIRED",
        related.media.length
          ? "برای ارسال عکس یا ویدیو، مشتری باید در ۲۴ ساعت اخیر در واتس‌اپ پیام داده باشد. ابتدا قالب را بفرستید و پس از پاسخ مشتری دوباره ارسال کنید."
          : "ارسال متن آزاد خارج از پنجره مکالمه مجاز نیست؛ از قالب تأییدشده Meta استفاده کنید.",
        422,
      );
      await recordRejectedAttempt(input, session, customer, agentId, recipientPhone, error);
      throw error;
    }
    if (!related.preview) {
      const error = new WhatsAppServiceError("WHATSAPP_TEXT_REQUIRED", "متن پیام الزامی است.", 422);
      await recordRejectedAttempt(input, session, customer, agentId, recipientPhone, error);
      throw error;
    }
  }

  const templateName = input.templateName?.trim() || whatsappConfig.testTemplateName;
  if (isTemplate && templateName !== whatsappConfig.testTemplateName) {
    const error = new WhatsAppServiceError("WHATSAPP_TEMPLATE_NOT_CONFIGURED", "فقط قالب تأییدشده و تنظیم‌شده Meta قابل ارسال است.", 422);
    await recordRejectedAttempt(input, session, customer, agentId, recipientPhone, error);
    throw error;
  }
  const language = input.language?.trim() || whatsappConfig.templateLanguage;
  if (isTemplate && !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language)) {
    const error = new WhatsAppServiceError("WHATSAPP_INVALID_LANGUAGE", "کد زبان قالب معتبر نیست.", 422);
    await recordRejectedAttempt(input, session, customer, agentId, recipientPhone, error);
    throw error;
  }

  let message: RecordLike;
  try {
    message = (await WhatsAppMessage.create({
      agentId: objectIdOrUndefined(agentId),
      clientRequestId: input.clientRequestId,
      createdBy: objectIdOrUndefined(session.userId),
      customerId,
      direction: "OUTBOUND",
      followUpId: related.followUp?._id,
      matchId: related.match?._id,
      mediaUrls: related.media.map((item) => item.url),
      messageType: input.messageType,
      propertyId: related.property?._id,
      provider: "META_CLOUD_API",
      recipientPhone,
      senderPhoneNumberId: whatsappConfig.phoneNumberId,
      status: "QUEUED",
      templateLanguage: isTemplate ? language : undefined,
      templateName: isTemplate ? templateName : undefined,
      text: isTemplate ? `Meta template: ${templateName}` : related.preview,
    })).toObject() as RecordLike;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const duplicate = await WhatsAppMessage.findOne({ clientRequestId: input.clientRequestId }).lean<RecordLike | null>();
    if (!duplicate) throw error;
    assertCanAccessMessage(session, duplicate);
    return { deduplicated: true, message: serializeMongo(duplicate) };
  }

  const startedAt = Date.now();
  await WhatsAppMessage.updateOne({ _id: message._id }, { $set: { status: "SENDING" } });
  try {
    const provider = new MetaWhatsAppProvider();
    const result = await provider.sendMessage({
      language,
      media: related.media,
      templateName: isTemplate ? templateName : undefined,
      text: isTemplate ? undefined : related.preview,
      to: recipientPhone,
      transport: isTemplate ? "TEMPLATE" : "TEXT",
    });
    const sentAt = new Date();
    const updated = await WhatsAppMessage.findByIdAndUpdate(
      message._id,
      { $set: { providerMessageId: result.providerMessageId, providerMessageIds: result.providerMessageIds, sentAt, status: "SENT" } },
      { returnDocument: "after" },
    ).lean<RecordLike | null>();
    await logActivity({
      action: "WHATSAPP_SENT",
      description: `${session.name} sent a WhatsApp message to ${String(customer.fullName)}.`,
      entityId: String(customer._id),
      entityType: "CUSTOMER",
      metadata: {
        duration: Date.now() - startedAt,
        messageId: String(message._id),
        providerMessageId: result.providerMessageId,
        mediaCount: related.media.length,
        status: "SENT",
      },
      session,
    });
    return { deduplicated: false, message: serializeMongo(updated) };
  } catch (error) {
    const serviceError = error instanceof WhatsAppServiceError
      ? error
      : new WhatsAppServiceError("WHATSAPP_SEND_FAILED", "ارسال پیام واتساپ ناموفق بود.", 502);
    const failedAt = new Date();
    const failed = await WhatsAppMessage.findByIdAndUpdate(
      message._id,
      {
        $set: {
          errorCode: serviceError.providerCode || serviceError.code,
          errorMessage: serviceError.publicMessage,
          failedAt,
          status: "FAILED",
        },
      },
      { returnDocument: "after" },
    ).lean<RecordLike | null>();
    if (failed) {
      await createFailureNotification(failed, agentId).catch((notificationError) =>
        console.error("[whatsapp:failure-notification]", notificationError),
      );
    }
    throw serviceError;
  }
}

export async function getWhatsAppMessages(
  searchParams: URLSearchParams,
  session: SessionUser,
  scope: AgentScope,
) {
  await connectToDatabase();
  const { limit, page, skip } = getPagination(searchParams);
  const query: Record<string, unknown> = {};
  if (session.role === "AGENT") query.agentId = objectIdOrUndefined(session.agentId) || "__no_agent__";
  else if (scope.effectiveAgentId) query.agentId = objectIdOrUndefined(scope.effectiveAgentId) || "__no_agent__";

  for (const key of ["status", "direction", "messageType"] as const) {
    const value = searchParams.get(key)?.trim();
    if (value) query[key] = value;
  }
  const customerId = objectIdOrUndefined(searchParams.get("customerId"));
  if (customerId) query.customerId = customerId;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) {
    query.createdAt = {
      ...(from ? { $gte: new Date(`${from}T00:00:00`) } : {}),
      ...(to ? { $lte: new Date(`${to}T23:59:59.999`) } : {}),
    };
  }

  const [items, total] = await Promise.all([
    WhatsAppMessage.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerId", "fullName phone whatsapp")
      .populate("agentId", "fullName name email")
      .populate("createdBy", "name email role")
      .lean(),
    WhatsAppMessage.countDocuments(query),
  ]);
  return { items: serializeMongo(items), pagination: paginationMeta(total, page, limit) };
}

export async function getWhatsAppMessageById(id: string, session: SessionUser) {
  await connectToDatabase();
  const _id = objectIdOrUndefined(id);
  if (!_id) return null;
  const message = await WhatsAppMessage.findById(_id)
    .populate("customerId", "fullName phone whatsapp")
    .populate("agentId", "fullName name email")
    .populate("createdBy", "name email role")
    .populate("propertyId", "title propertyCode price currency city district rooms grossArea")
    .populate("matchId", "score status")
    .populate("followUpId", "title type status dueAt")
    .lean<RecordLike | null>();
  if (!message) return null;
  assertCanAccessMessage(session, message);
  return serializeMongo(message);
}

export function getPublicWhatsAppConfiguration() {
  return publicWhatsAppConfiguration();
}
