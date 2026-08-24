import type { IdLike } from "@/services/notifications/notification.types";

function id(value: IdLike) {
  return String(value);
}

export const notificationDeduplicationKey = {
  automationFailed: (automationJobId: IdLike) => `AUTOMATION_FAILED:${id(automationJobId)}`,
  automationPartial: (automationJobId: IdLike) => `AUTOMATION_PARTIAL:${id(automationJobId)}`,
  customerAssigned: (customerId: IdLike, agentId: IdLike, assignmentVersion: IdLike) =>
    `CUSTOMER_ASSIGNED:${id(customerId)}:${id(agentId)}:${id(assignmentVersion)}`,
  customerReassigned: (customerId: IdLike, agentId: IdLike, assignmentVersion: IdLike) =>
    `CUSTOMER_REASSIGNED:${id(customerId)}:${id(agentId)}:${id(assignmentVersion)}`,
  followupCreated: (followUpId: IdLike) => `FOLLOWUP_CREATED:${id(followUpId)}`,
  followupDue: (followUpId: IdLike, dayKey: string) => `FOLLOWUP_DUE:${id(followUpId)}:${dayKey}`,
  followupOverdue: (followUpId: IdLike) => `FOLLOWUP_OVERDUE:${id(followUpId)}`,
  importCompleted: (importJobId: IdLike) => `IMPORT_COMPLETED:${id(importJobId)}`,
  importFailed: (importJobId: IdLike) => `IMPORT_FAILED:${id(importJobId)}`,
  importPartial: (importJobId: IdLike) => `IMPORT_PARTIAL:${id(importJobId)}`,
  inactiveCustomer: (customerId: IdLike) => `INACTIVE_CUSTOMER:${id(customerId)}`,
  newMatch: (matchId: IdLike) => `NEW_MATCH:${id(matchId)}`,
};
