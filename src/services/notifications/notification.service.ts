import { Types } from "mongoose";
import { canManageTeam } from "@/lib/auth/roles";
import { escapeRegex, paginationMeta } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { Agent, Notification } from "@/models";
import {
  NOTIFICATION_DEFAULT_PRIORITY,
  NOTIFICATION_TYPE_CATEGORY,
} from "@/services/notifications/notification.config";
import { notificationDeduplicationKey } from "@/services/notifications/notification-deduplication";
import { resolveAdminRecipients, resolveAgentRecipient, toObjectId } from "@/services/notifications/notification-recipient";
import {
  buildCustomerAssignedNotification,
  buildCustomerReassignedInNotification,
  buildCustomerReassignedOutNotification,
  buildFollowUpCreatedNotification,
  buildFollowUpDueNotification,
  buildFollowUpOverdueNotification,
  buildFollowUpUpdatedNotification,
  buildNewMatchNotification,
} from "@/services/notifications/notification.templates";
import type {
  CreateNotificationInput,
  IdLike,
  NotificationFilters,
  NotificationScopeInput,
} from "@/services/notifications/notification.types";
import { safeNotificationActionUrl } from "@/services/notifications/notification-url";
import { publishRealtimeEvent } from "@/services/realtime/realtime-bus";

function isDuplicateKeyError(error: unknown) {
  return error instanceof Error && error.message.includes("duplicate key");
}

function objectId(value?: IdLike) {
  return toObjectId(value);
}

function cleanRefs(input: CreateNotificationInput) {
  return {
    automationJobId: objectId(input.automationJobId),
    customerId: objectId(input.customerId),
    entityId: objectId(input.entityId),
    entityType: input.entityType,
    followUpId: objectId(input.followUpId),
    importJobId: objectId(input.importJobId),
    matchId: objectId(input.matchId),
    propertyId: objectId(input.propertyId),
  };
}

export async function createNotification(input: CreateNotificationInput) {
  await connectToDatabase();

  if (!input.recipientAgentId && !input.recipientUserId) {
    return { created: false, notification: null, reason: "NO_RECIPIENT" as const };
  }

  const recipientAgentId = objectId(input.recipientAgentId);
  const recipientUserId = objectId(input.recipientUserId);
  const deduplicationKey = input.deduplicationKey?.trim() || undefined;
  const category = input.category || NOTIFICATION_TYPE_CATEGORY[input.type];
  const priority = input.priority || NOTIFICATION_DEFAULT_PRIORITY[input.type] || "NORMAL";

  try {
    const notification = await Notification.create({
      ...cleanRefs(input),
      actionUrl: safeNotificationActionUrl(input.actionUrl),
      agentId: recipientAgentId,
      body: input.message,
      category,
      channels: input.channels || ["IN_APP"],
      dedupeKey: deduplicationKey,
      deduplicationKey,
      message: input.message,
      payload: input.payload,
      priority,
      recipientAgentId,
      recipientUserId,
      status: "UNREAD",
      title: input.title,
      type: input.type,
      user: recipientUserId,
      userId: recipientUserId,
    });
    await publishRealtimeEvent({
      agentId: recipientAgentId ? String(recipientAgentId) : undefined,
      notificationId: String(notification._id),
      resource: "notifications",
      type: "notification.created",
      userId: recipientUserId ? String(recipientUserId) : undefined,
    });
    return { created: true, notification };
  } catch (error) {
    if (deduplicationKey && isDuplicateKeyError(error)) {
      const notification = await Notification.findOne({ deduplicationKey }).lean();
      return { created: false, notification, reason: "DEDUPLICATED" as const };
    }
    throw error;
  }
}

export async function createAgentNotification(input: Omit<CreateNotificationInput, "recipientUserId"> & { recipientAgentId: IdLike; recipientUserId?: IdLike }) {
  const recipient = await resolveAgentRecipient(input.recipientAgentId);
  return createNotification({ ...input, ...recipient, recipientUserId: input.recipientUserId || recipient.recipientUserId });
}

export async function createAdminNotification(input: Omit<CreateNotificationInput, "recipientAgentId" | "recipientUserId">) {
  await connectToDatabase();
  const admins = await resolveAdminRecipients();
  const created = await Promise.all(
    admins.map((admin) =>
      createNotification({
        ...input,
        deduplicationKey: input.deduplicationKey ? `${input.deduplicationKey}:ADMIN:${String(admin._id)}` : undefined,
        recipientUserId: admin._id,
      }),
    ),
  );
  return created;
}

export function notificationScopeQuery({ scope, session }: NotificationScopeInput) {
  const userId = objectId(session.userId);
  const effectiveAgentId = objectId(scope.effectiveAgentId);
  const currentAgentId = objectId(scope.currentAgentId);

  if (session.role === "AGENT") {
    if (effectiveAgentId && (!currentAgentId || String(currentAgentId) !== String(effectiveAgentId))) {
      throw new Error("FORBIDDEN");
    }
    if (!currentAgentId && !userId) throw new Error("FORBIDDEN");
    return {
      $or: [
        ...(currentAgentId ? [{ recipientAgentId: currentAgentId }, { agentId: currentAgentId }] : []),
        ...(userId ? [{ recipientUserId: userId }, { userId }, { user: userId }] : []),
      ],
    };
  }

  if (effectiveAgentId) {
    return { recipientAgentId: effectiveAgentId };
  }

  if (canManageTeam(session.role)) return {};
  return userId ? { recipientUserId: userId } : { _id: "__no_notification__" };
}

export function applyNotificationFilters(baseQuery: Record<string, unknown>, filters: NotificationFilters) {
  const query: Record<string, unknown> = { ...baseQuery };

  if (filters.agentId) {
    const agentId = objectId(filters.agentId);
    if (agentId) query.recipientAgentId = agentId;
  }
  if (filters.status && filters.status !== "ALL") query.status = filters.status;
  else query.status = { $ne: "ARCHIVED" };
  if (filters.category) query.category = filters.category;
  if (filters.type) query.type = filters.type;
  if (filters.priority) query.priority = filters.priority;
  if (filters.q) {
    const regex = new RegExp(escapeRegex(filters.q), "i");
    query.$and = [...(Array.isArray(query.$and) ? query.$and : []), { $or: [{ title: regex }, { message: regex }, { body: regex }] }];
  }

  return query;
}

export async function getNotifications(input: NotificationScopeInput & { filters?: NotificationFilters }) {
  await connectToDatabase();
  const filters = input.filters || {};
  const limit = Math.min(Math.max(Number(filters.limit || 20), 1), 100);
  const page = Math.max(Number(filters.page || 1), 1);
  const skip = (page - 1) * limit;
  const baseQuery = notificationScopeQuery(input);
  const query = applyNotificationFilters(baseQuery, filters);

  const [items, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("recipientAgentId", "fullName name email")
      .lean(),
    Notification.countDocuments(query),
  ]);

  return {
    items: serializeMongo(items),
    pagination: paginationMeta(total, page, limit),
  };
}

export async function getUnreadCount(input: NotificationScopeInput & { filters?: Pick<NotificationFilters, "agentId"> }) {
  await connectToDatabase();
  const baseQuery = notificationScopeQuery(input);
  const query = applyNotificationFilters(baseQuery, { agentId: input.filters?.agentId, status: "UNREAD" });
  return Notification.countDocuments(query);
}

async function findScopedNotification(notificationId: string, input: NotificationScopeInput) {
  const _id = objectId(notificationId);
  if (!_id) return null;
  const query = notificationScopeQuery(input);
  return Notification.findOne({ _id, ...query });
}

export async function markNotificationAsRead(notificationId: string, input: NotificationScopeInput) {
  await connectToDatabase();
  const notification = await findScopedNotification(notificationId, input);
  if (!notification) throw new Error("FORBIDDEN");
  if (notification.status !== "READ") {
    notification.status = "READ";
    notification.readAt = new Date();
    await notification.save();
  }
  return serializeMongo(notification.toObject());
}

export async function markAllAsRead(input: NotificationScopeInput & { filters?: Pick<NotificationFilters, "agentId"> }) {
  await connectToDatabase();
  const baseQuery = notificationScopeQuery(input);
  const query = applyNotificationFilters(baseQuery, { agentId: input.filters?.agentId, status: "UNREAD" });
  const result = await Notification.updateMany(query, { $set: { readAt: new Date(), status: "READ" } });
  return { modifiedCount: result.modifiedCount };
}

export async function archiveNotification(notificationId: string, input: NotificationScopeInput) {
  await connectToDatabase();
  const notification = await findScopedNotification(notificationId, input);
  if (!notification) throw new Error("FORBIDDEN");
  notification.status = "ARCHIVED";
  await notification.save();
  return serializeMongo(notification.toObject());
}

export async function getNotificationSummary(input: NotificationScopeInput & { filters?: Pick<NotificationFilters, "agentId"> }) {
  await connectToDatabase();
  const baseQuery = notificationScopeQuery(input);
  const agentId = input.filters?.agentId;
  const unarchived = applyNotificationFilters(baseQuery, { agentId, status: "ALL" });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const importantPriorities = ["HIGH", "URGENT"];

  const [all, unread, todayCount, important] = await Promise.all([
    Notification.countDocuments({ ...unarchived, status: { $ne: "ARCHIVED" } }),
    Notification.countDocuments(applyNotificationFilters(baseQuery, { agentId, status: "UNREAD" })),
    Notification.countDocuments({ ...unarchived, createdAt: { $gte: today }, status: { $ne: "ARCHIVED" } }),
    Notification.countDocuments({ ...unarchived, priority: { $in: importantPriorities }, status: { $ne: "ARCHIVED" } }),
  ]);

  return { all, important, today: todayCount, unread };
}

export async function getRecentNotifications(input: NotificationScopeInput & { limit?: number }) {
  await connectToDatabase();
  const query = applyNotificationFilters(notificationScopeQuery(input), { status: "UNREAD" });
  return serializeMongo(
    await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(input.limit || 5, 1), 10))
      .populate("recipientAgentId", "fullName name email")
      .lean(),
  );
}

export async function createNewMatchNotification(input: {
  agentId?: IdLike;
  customerId: IdLike;
  customerName?: string;
  matchId: IdLike;
  propertyId: IdLike;
  propertyTitle?: string;
  score: number;
}) {
  if (!input.agentId) return { created: false, notification: null, reason: "NO_AGENT" as const };
  const template = buildNewMatchNotification(input);
  return createAgentNotification({
    ...template,
    category: "MATCH",
    customerId: input.customerId,
    deduplicationKey: notificationDeduplicationKey.newMatch(input.matchId),
    entityId: input.matchId,
    entityType: "MATCH",
    matchId: input.matchId,
    priority: "NORMAL",
    propertyId: input.propertyId,
    recipientAgentId: input.agentId,
    type: "NEW_MATCH",
  });
}

export async function createFollowUpCreatedNotification(input: {
  actorName?: string;
  agentId?: IdLike;
  customerId?: IdLike;
  customerName?: string;
  dueAt?: Date | string;
  followUpId: IdLike;
  managerMessage?: string;
}) {
  if (!input.agentId) return { created: false, notification: null, reason: "NO_AGENT" as const };
  const template = buildFollowUpCreatedNotification(input);
  return createAgentNotification({
    ...template,
    category: "FOLLOWUP",
    customerId: input.customerId,
    deduplicationKey: notificationDeduplicationKey.followupCreated(input.followUpId),
    entityId: input.followUpId,
    entityType: "FOLLOW_UP",
    followUpId: input.followUpId,
    priority: "NORMAL",
    recipientAgentId: input.agentId,
    type: "FOLLOWUP_CREATED",
  });
}

export async function createFollowUpUpdatedNotification(input: {
  actorName?: string;
  agentId?: IdLike;
  customerId?: IdLike;
  customerName?: string;
  followUpId: IdLike;
  managerMessage?: string;
}) {
  if (!input.agentId) return { created: false, notification: null, reason: "NO_AGENT" as const };
  const template = buildFollowUpUpdatedNotification(input);
  return createAgentNotification({
    ...template,
    category: "FOLLOWUP",
    customerId: input.customerId,
    entityId: input.followUpId,
    entityType: "FOLLOW_UP",
    followUpId: input.followUpId,
    priority: input.managerMessage?.trim() ? "HIGH" : "NORMAL",
    recipientAgentId: input.agentId,
    type: "FOLLOWUP_UPDATED",
  });
}

export async function createFollowUpDueNotification(input: {
  agentId?: IdLike;
  customerId?: IdLike;
  customerName?: string;
  dayKey: string;
  dueAt?: Date | string;
  followUpId: IdLike;
  jobId?: IdLike;
}) {
  if (!input.agentId) return { created: false, notification: null, reason: "NO_AGENT" as const };
  const template = buildFollowUpDueNotification(input);
  return createAgentNotification({
    ...template,
    automationJobId: input.jobId,
    category: "FOLLOWUP",
    customerId: input.customerId,
    deduplicationKey: notificationDeduplicationKey.followupDue(input.followUpId, input.dayKey),
    entityId: input.followUpId,
    entityType: "FOLLOW_UP",
    followUpId: input.followUpId,
    recipientAgentId: input.agentId,
    type: "FOLLOWUP_DUE",
  });
}

export async function createFollowUpOverdueNotification(input: {
  agentId?: IdLike;
  customerId?: IdLike;
  customerName?: string;
  dueAt?: Date | string;
  followUpId: IdLike;
  jobId?: IdLike;
}) {
  if (!input.agentId) return { created: false, notification: null, reason: "NO_AGENT" as const };
  const template = buildFollowUpOverdueNotification(input);
  return createAgentNotification({
    ...template,
    automationJobId: input.jobId,
    category: "FOLLOWUP",
    customerId: input.customerId,
    deduplicationKey: notificationDeduplicationKey.followupOverdue(input.followUpId),
    entityId: input.followUpId,
    entityType: "FOLLOW_UP",
    followUpId: input.followUpId,
    priority: "HIGH",
    recipientAgentId: input.agentId,
    type: "FOLLOWUP_OVERDUE",
  });
}

export async function createCustomerAssignedNotification(input: { agentId?: IdLike; customerId: IdLike; customerName?: string }) {
  if (!input.agentId) return { created: false, notification: null, reason: "NO_AGENT" as const };
  const template = buildCustomerAssignedNotification(input.customerName);
  return createAgentNotification({
    ...template,
    actionUrl: `/customers/${String(input.customerId)}`,
    category: "CUSTOMER",
    customerId: input.customerId,
    deduplicationKey: notificationDeduplicationKey.customerAssigned(input.customerId, input.agentId, input.agentId),
    entityId: input.customerId,
    entityType: "CUSTOMER",
    recipientAgentId: input.agentId,
    type: "CUSTOMER_ASSIGNED",
  });
}

export async function createCustomerReassignedNotifications(input: {
  customerId: IdLike;
  customerName?: string;
  fromAgentId?: IdLike;
  toAgentId?: IdLike;
}) {
  const tasks = [];
  if (input.toAgentId) {
    const template = buildCustomerReassignedInNotification(input.customerName);
    tasks.push(
      createAgentNotification({
        ...template,
        actionUrl: `/customers/${String(input.customerId)}`,
        category: "CUSTOMER",
        customerId: input.customerId,
        deduplicationKey: notificationDeduplicationKey.customerReassigned(input.customerId, input.toAgentId, `${input.fromAgentId || "none"}-${input.toAgentId}`),
        entityId: input.customerId,
        entityType: "CUSTOMER",
        recipientAgentId: input.toAgentId,
        type: "CUSTOMER_REASSIGNED",
      }),
    );
  }
  if (input.fromAgentId && String(input.fromAgentId) !== String(input.toAgentId || "")) {
    const template = buildCustomerReassignedOutNotification(input.customerName);
    tasks.push(
      createAgentNotification({
        ...template,
        actionUrl: `/customers/${String(input.customerId)}`,
        category: "CUSTOMER",
        customerId: input.customerId,
        deduplicationKey: notificationDeduplicationKey.customerReassigned(input.customerId, input.fromAgentId, `${input.fromAgentId}-out-${input.toAgentId || "none"}`),
        entityId: input.customerId,
        entityType: "CUSTOMER",
        priority: "LOW",
        recipientAgentId: input.fromAgentId,
        type: "CUSTOMER_REASSIGNED",
      }),
    );
  }
  return Promise.all(tasks);
}

export async function listNotificationAgents() {
  await connectToDatabase();
  return serializeMongo(await Agent.find({ isActive: { $ne: false } }).sort({ fullName: 1, name: 1 }).select("_id fullName name email").lean());
}

export function isValidObjectIdString(value: string) {
  return Types.ObjectId.isValid(value);
}
