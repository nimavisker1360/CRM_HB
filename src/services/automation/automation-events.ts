import type { Types } from "mongoose";
import {
  createAdminNotification,
  createAgentNotification,
} from "@/services/notifications/notification.service";
import { NOTIFICATION_DEFAULT_PRIORITY, NOTIFICATION_TYPE_CATEGORY } from "@/services/notifications/notification.config";
import type { NotificationType } from "@/services/notifications/notification.types";

type AutomationEventInput = {
  agentId?: Types.ObjectId | string;
  automationJobId?: Types.ObjectId | string;
  body?: string;
  customerId?: Types.ObjectId | string;
  dedupeKey: string;
  followUpId?: Types.ObjectId | string;
  matchId?: Types.ObjectId | string;
  payload?: Record<string, unknown>;
  propertyId?: Types.ObjectId | string;
  title: string;
  type: NotificationType | "NEW_MATCH_FOUND";
  userId?: Types.ObjectId | string;
};

export async function createAutomationEvent(input: AutomationEventInput) {
  const type = input.type === "NEW_MATCH_FOUND" ? "NEW_MATCH" : input.type;
  const base = {
    actionUrl: actionUrlForEvent(type, input),
    automationJobId: input.automationJobId,
    category: NOTIFICATION_TYPE_CATEGORY[type],
    customerId: input.customerId,
    deduplicationKey: input.dedupeKey,
    entityId: input.matchId || input.followUpId || input.customerId || input.automationJobId,
    entityType: entityTypeForEvent(type),
    followUpId: input.followUpId,
    matchId: input.matchId,
    message: input.body || input.title,
    payload: input.payload,
    priority: NOTIFICATION_DEFAULT_PRIORITY[type],
    propertyId: input.propertyId,
    title: input.title,
    type,
  } as const;

  const result =
    input.agentId || input.userId
      ? await createAgentNotification({
          ...base,
          recipientAgentId: input.agentId || "",
          recipientUserId: input.userId,
        })
      : await createAdminNotification(base);

  return Array.isArray(result) ? result.some((item) => item.created) : result.created;
}

function entityTypeForEvent(type: NotificationType) {
  if (type === "FOLLOWUP_DUE" || type === "FOLLOWUP_OVERDUE") return "FOLLOW_UP";
  if (type === "INACTIVE_CUSTOMER") return "CUSTOMER";
  if (type === "AUTOMATION_FAILED" || type === "AUTOMATION_PARTIAL") return "AUTOMATION_JOB";
  if (type === "NEW_MATCH" || type === "PROPERTY_MATCH_FOUND") return "MATCH";
  return "SYSTEM";
}

function actionUrlForEvent(type: NotificationType, input: AutomationEventInput) {
  if ((type === "FOLLOWUP_DUE" || type === "FOLLOWUP_OVERDUE") && input.followUpId) {
    return `/follow-ups/${String(input.followUpId)}`;
  }
  if (type === "INACTIVE_CUSTOMER" && input.customerId) return `/customers/${String(input.customerId)}`;
  if ((type === "AUTOMATION_FAILED" || type === "AUTOMATION_PARTIAL") && input.automationJobId) {
    return `/automation/${String(input.automationJobId)}`;
  }
  if ((type === "NEW_MATCH" || type === "PROPERTY_MATCH_FOUND") && input.matchId) {
    return `/matches/${String(input.matchId)}`;
  }
  return undefined;
}
