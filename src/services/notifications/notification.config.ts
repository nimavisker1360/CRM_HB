import type { NotificationCategory, NotificationPriority, NotificationType } from "@/services/notifications/notification.types";

export const NOTIFICATION_MATCH_MIN_SCORE = Number(process.env.NOTIFICATION_MATCH_MIN_SCORE || 80);

export const NOTIFICATION_TYPE_CATEGORY: Record<NotificationType, NotificationCategory> = {
  AUTOMATION_FAILED: "AUTOMATION",
  AUTOMATION_PARTIAL: "AUTOMATION",
  CUSTOMER_ASSIGNED: "CUSTOMER",
  CUSTOMER_REASSIGNED: "CUSTOMER",
  FOLLOWUP_CREATED: "FOLLOWUP",
  FOLLOWUP_UPDATED: "FOLLOWUP",
  FOLLOWUP_DUE: "FOLLOWUP",
  FOLLOWUP_OVERDUE: "FOLLOWUP",
  IMPORT_COMPLETED: "IMPORT",
  IMPORT_FAILED: "IMPORT",
  IMPORT_PARTIAL: "IMPORT",
  INACTIVE_CUSTOMER: "CUSTOMER",
  NEW_MATCH: "MATCH",
  PROPERTY_MATCH_FOUND: "MATCH",
  SYSTEM: "SYSTEM",
};

export const NOTIFICATION_DEFAULT_PRIORITY: Record<NotificationType, NotificationPriority> = {
  AUTOMATION_FAILED: "HIGH",
  AUTOMATION_PARTIAL: "HIGH",
  CUSTOMER_ASSIGNED: "NORMAL",
  CUSTOMER_REASSIGNED: "NORMAL",
  FOLLOWUP_CREATED: "NORMAL",
  FOLLOWUP_UPDATED: "NORMAL",
  FOLLOWUP_DUE: "NORMAL",
  FOLLOWUP_OVERDUE: "HIGH",
  IMPORT_COMPLETED: "NORMAL",
  IMPORT_FAILED: "HIGH",
  IMPORT_PARTIAL: "HIGH",
  INACTIVE_CUSTOMER: "NORMAL",
  NEW_MATCH: "NORMAL",
  PROPERTY_MATCH_FOUND: "NORMAL",
  SYSTEM: "NORMAL",
};

export const NOTIFICATION_INTERNAL_ROUTES = [
  "/automation",
  "/customers",
  "/dashboard",
  "/follow-ups",
  "/import",
  "/import-center",
  "/matches",
  "/notifications",
  "/properties",
  "/projects",
  "/settings",
] as const;
