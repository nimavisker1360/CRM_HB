import "server-only";
import { connectToDatabase } from "@/lib/mongodb";
import { stringifyId } from "@/lib/auth/agent-scope";
import { Customer, WhatsAppMessage, WhatsAppWebhookEvent } from "@/models";
import { createAdminNotification, createAgentNotification } from "@/services/notifications/notification.service";
import { whatsappConfig } from "@/services/whatsapp/whatsapp.config";
import { normalizeWhatsAppPhone, phoneSearchPattern } from "@/services/whatsapp/whatsapp.normalizer";
import { sanitizeMetaWebhookError } from "@/services/whatsapp/whatsapp.provider";
import { allowedPreviousWhatsAppStatuses, mapMetaStatus } from "@/services/whatsapp/whatsapp.status";
import type { MetaWebhookPayload } from "@/services/whatsapp/whatsapp.types";
import { verifySha256Signature } from "@/services/whatsapp/whatsapp.signature";

type RecordLike = Record<string, unknown> & { _id: unknown };

export function verifyMetaWebhookSignature(rawBody: string, signature: string | null, appSecret = whatsappConfig.appSecret) {
  return verifySha256Signature(rawBody, signature, appSecret);
}

async function claimWebhookEvent(eventKey: string, eventType: "STATUS" | "INBOUND", providerMessageId: string) {
  try {
    return await WhatsAppWebhookEvent.create({ eventKey, eventType, providerMessageId });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) return null;
    throw error;
  }
}

async function processClaimedEvent<T>(event: RecordLike, task: () => Promise<T>) {
  try {
    const result = await task();
    await WhatsAppWebhookEvent.updateOne({ _id: event._id }, { $set: { processedAt: new Date() } });
    return result;
  } catch (error) {
    await WhatsAppWebhookEvent.deleteOne({ _id: event._id });
    throw error;
  }
}

function providerDate(timestamp?: string) {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
}

async function notifyDeliveryFailure(message: RecordLike) {
  const common = {
    actionUrl: `/whatsapp/${String(message._id)}`,
    category: "SYSTEM" as const,
    customerId: message.customerId as string,
    deduplicationKey: `whatsapp:delivery-failed:${String(message._id)}`,
    entityId: message.customerId as string,
    entityType: "CUSTOMER" as const,
    message: "تحویل پیام واتساپ ناموفق بود.",
    priority: "HIGH" as const,
    title: "خطا در تحویل WhatsApp",
    type: "SYSTEM" as const,
  };
  const agentId = stringifyId(message.agentId);
  if (agentId) return createAgentNotification({ ...common, recipientAgentId: agentId });
  return createAdminNotification(common);
}

async function processStatus(status: NonNullable<NonNullable<MetaWebhookPayload["entry"]>[number]["changes"]>[number]["value"] extends infer V
  ? V extends { statuses?: Array<infer S> } ? S : never
  : never) {
  const providerMessageId = String(status?.id || "");
  const mapped = mapMetaStatus(status?.status);
  if (!providerMessageId || !mapped) return { ignored: true };
  const eventKey = `status:${providerMessageId}:${status?.status}:${status?.timestamp || "none"}`;
  const claim = await claimWebhookEvent(eventKey, "STATUS", providerMessageId);
  if (!claim) return { duplicate: true };

  return processClaimedEvent(claim.toObject() as RecordLike, async () => {
    const timestamp = providerDate(status?.timestamp);
    const error = mapped === "FAILED" ? sanitizeMetaWebhookError(status?.errors?.[0]) : null;
    const timestampUpdate = mapped === "SENT"
      ? { sentAt: timestamp }
      : mapped === "DELIVERED"
        ? { deliveredAt: timestamp }
        : mapped === "READ"
          ? { readAt: timestamp }
          : { failedAt: timestamp };
    const message = await WhatsAppMessage.findOneAndUpdate(
      {
        $or: [{ providerMessageId }, { providerMessageIds: providerMessageId }],
        status: { $in: allowedPreviousWhatsAppStatuses[mapped] },
      },
      {
        $set: {
          ...timestampUpdate,
          ...(error ? { errorCode: error.code, errorMessage: error.message } : {}),
          providerTimestamp: timestamp,
          status: mapped,
        },
      },
      { returnDocument: "after" },
    ).lean<RecordLike | null>();
    if (mapped === "FAILED" && message) {
      await notifyDeliveryFailure(message).catch((notificationError) =>
        console.error("[whatsapp:webhook-failure-notification]", notificationError),
      );
    }
    return { status: mapped, updated: Boolean(message) };
  });
}

async function findCustomerByWhatsAppPhone(phone: string) {
  const regex = new RegExp(phoneSearchPattern(phone), "i");
  const candidates = await Customer.find({ $or: [{ whatsapp: regex }, { phone: regex }] })
    .select("_id assignedAgent assignedAgentId phone whatsapp")
    .limit(20)
    .lean<RecordLike[]>();
  return candidates.find((candidate) => {
    const preferred = normalizeWhatsAppPhone(String(candidate.whatsapp || ""));
    const fallback = normalizeWhatsAppPhone(String(candidate.phone || ""));
    return preferred === phone || (!preferred && fallback === phone);
  }) || null;
}

async function processInbound(
  inbound: { from?: string; id?: string; text?: { body?: string }; timestamp?: string; type?: string },
  phoneNumberId?: string,
) {
  const providerMessageId = String(inbound.id || "");
  const senderPhone = normalizeWhatsAppPhone(inbound.from);
  if (!providerMessageId || !senderPhone) return { ignored: true };
  const eventKey = `inbound:${providerMessageId}`;
  const claim = await claimWebhookEvent(eventKey, "INBOUND", providerMessageId);
  if (!claim) return { duplicate: true };

  return processClaimedEvent(claim.toObject() as RecordLike, async () => {
    const customer = await findCustomerByWhatsAppPhone(senderPhone);
    const receivedAt = providerDate(inbound.timestamp);
    await WhatsAppMessage.create({
      agentId: customer?.assignedAgentId || customer?.assignedAgent,
      customerId: customer?._id,
      deliveredAt: receivedAt,
      direction: "INBOUND",
      lastInboundAt: receivedAt,
      messageType: inbound.type === "text" ? "TEXT" : "SYSTEM",
      provider: "META_CLOUD_API",
      providerMessageId,
      providerTimestamp: receivedAt,
      recipientPhone: senderPhone,
      senderPhoneNumberId: phoneNumberId || whatsappConfig.phoneNumberId,
      status: "DELIVERED",
      text: inbound.text?.body || `[${inbound.type || "unknown"} message]`,
    });
    return { customerMatched: Boolean(customer), inbound: true };
  });
}

export async function processMetaWebhook(payload: MetaWebhookPayload) {
  await connectToDatabase();
  const tasks: Array<Promise<unknown>> = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      for (const status of value?.statuses || []) tasks.push(processStatus(status));
      for (const message of value?.messages || []) tasks.push(processInbound(message, value?.metadata?.phone_number_id));
    }
  }
  const results = await Promise.all(tasks);
  return { events: results.length, results };
}
