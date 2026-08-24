import type { Types } from "mongoose";
import type { AgentScope } from "@/lib/auth/agent-scope";
import type { SessionUser } from "@/lib/auth/session";

export const NOTIFICATION_TYPES = [
  "NEW_MATCH",
  "FOLLOWUP_CREATED",
  "FOLLOWUP_DUE",
  "FOLLOWUP_OVERDUE",
  "CUSTOMER_ASSIGNED",
  "CUSTOMER_REASSIGNED",
  "INACTIVE_CUSTOMER",
  "PROPERTY_MATCH_FOUND",
  "IMPORT_COMPLETED",
  "IMPORT_PARTIAL",
  "IMPORT_FAILED",
  "AUTOMATION_FAILED",
  "AUTOMATION_PARTIAL",
  "SYSTEM",
] as const;

export const NOTIFICATION_CATEGORIES = ["MATCH", "FOLLOWUP", "CUSTOMER", "IMPORT", "AUTOMATION", "SYSTEM"] as const;
export const NOTIFICATION_STATUSES = ["UNREAD", "READ", "ARCHIVED"] as const;
export const NOTIFICATION_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const NOTIFICATION_CHANNELS = ["IN_APP", "WHATSAPP", "EMAIL", "PUSH"] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationEntityType =
  | "MATCH"
  | "FOLLOW_UP"
  | "CUSTOMER"
  | "PROPERTY"
  | "IMPORT_JOB"
  | "AUTOMATION_JOB"
  | "SYSTEM";

export type NotificationReferenceInput = {
  automationJobId?: IdLike;
  customerId?: IdLike;
  entityId?: IdLike;
  entityType?: NotificationEntityType;
  followUpId?: IdLike;
  importJobId?: IdLike;
  matchId?: IdLike;
  propertyId?: IdLike;
};

export type IdLike = string | Types.ObjectId;

export type CreateNotificationInput = NotificationReferenceInput & {
  actionUrl?: string;
  category: NotificationCategory;
  channels?: NotificationChannel[];
  deduplicationKey?: string;
  message: string;
  payload?: Record<string, unknown>;
  priority?: NotificationPriority;
  recipientAgentId?: IdLike;
  recipientUserId?: IdLike;
  title: string;
  type: NotificationType;
};

export type NotificationFilters = {
  agentId?: string;
  category?: NotificationCategory;
  limit?: number;
  page?: number;
  priority?: NotificationPriority;
  q?: string;
  status?: NotificationStatus | "ALL";
  type?: NotificationType;
};

export type NotificationScopeInput = {
  scope: AgentScope;
  session: SessionUser;
};
