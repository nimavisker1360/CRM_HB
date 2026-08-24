import { FollowUp } from "@/models";
import { createAutomationEvent } from "@/services/automation/automation-events";
import type { AutomationJobContext, AutomationJobResult } from "@/services/automation/automation.types";

export async function runOverdueFollowupJob(context: AutomationJobContext): Promise<AutomationJobResult> {
  const query = {
    status: { $in: ["PENDING", "OPEN"] },
    $or: [
      { scheduledAt: { $lt: context.now } },
      { scheduledAt: { $exists: false }, dueAt: { $lt: context.now } },
    ],
  };
  const followUps = await FollowUp.find(query)
    .sort({ scheduledAt: 1, dueAt: 1, _id: 1 })
    .limit(context.maxItems)
    .select("_id agentId customer customerId dueAt scheduledAt title")
    .populate("customerId", "fullName")
    .populate("customer", "fullName")
    .lean<Array<Record<string, unknown>>>();

  let eventsCreated = 0;
  let failedCount = 0;
  let successCount = 0;

  for (const followUp of followUps) {
    try {
      const created = await createAutomationEvent({
        agentId: followUp.agentId as never,
        automationJobId: context.jobId,
        body: `پیگیری مشتری ${customerName(followUp)} هنوز انجام نشده است.`,
        customerId: refId(followUp.customerId || followUp.customer) as never,
        dedupeKey: `FOLLOWUP_OVERDUE:${String(followUp._id)}`,
        followUpId: followUp._id as never,
        payload: { dueAt: followUp.dueAt, scheduledAt: followUp.scheduledAt },
        title: "پیگیری عقب‌افتاده",
        type: "FOLLOWUP_OVERDUE",
      });
      if (created) eventsCreated += 1;
      successCount += 1;
      await FollowUp.updateOne(
        { _id: followUp._id, status: { $in: ["PENDING", "OPEN"] } },
        { $set: { overdueFlaggedAt: new Date(), status: "OVERDUE" } },
      );
    } catch (error) {
      failedCount += 1;
      console.error("[overdue-followup-check]", context.runId, error);
    }
  }

  const remainingCount = await FollowUp.countDocuments(query);

  return {
    batchCount: followUps.length ? 1 : 0,
    failedCount,
    hasMore: remainingCount > 0,
    metadata: { eventsCreated, remainingCount },
    processedCount: followUps.length,
    successCount,
  };
}

function customerName(followUp: Record<string, unknown>) {
  const customer = (followUp.customerId || followUp.customer) as Record<string, unknown> | undefined;
  return String(customer?.fullName || "مشتری");
}

function refId(value: unknown) {
  if (value && typeof value === "object" && "_id" in value) return (value as { _id: unknown })._id;
  return value;
}
