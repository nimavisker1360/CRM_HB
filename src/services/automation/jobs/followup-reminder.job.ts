import { FollowUp } from "@/models";
import { getBusinessDayKey, getBusinessTodayBounds } from "@/services/automation/automation-date";
import { createAutomationEvent } from "@/services/automation/automation-events";
import type { AutomationJobContext, AutomationJobResult } from "@/services/automation/automation.types";

export async function runFollowupReminderJob(context: AutomationJobContext): Promise<AutomationJobResult> {
  const { end, start } = getBusinessTodayBounds(context.now);
  const dayKey = getBusinessDayKey(context.now);
  const query = {
    status: { $in: ["PENDING", "OPEN"] },
    $or: [
      { scheduledAt: { $gte: start, $lt: end } },
      { scheduledAt: { $exists: false }, dueAt: { $gte: start, $lt: end } },
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
        body: `امروز باید با ${customerName(followUp)} تماس بگیرید.`,
        customerId: refId(followUp.customerId || followUp.customer) as never,
        dedupeKey: `FOLLOWUP_DUE:${String(followUp._id)}:${dayKey}`,
        followUpId: followUp._id as never,
        payload: { dayKey, dueAt: followUp.dueAt, scheduledAt: followUp.scheduledAt },
        title: "پیگیری امروز",
        type: "FOLLOWUP_DUE",
      });
      if (created) eventsCreated += 1;
      successCount += 1;
      await FollowUp.updateOne(
        { _id: followUp._id },
        { $inc: { reminderCount: created ? 1 : 0 }, $set: { lastReminderAt: new Date() } },
      );
    } catch (error) {
      failedCount += 1;
      console.error("[followup-reminder]", context.runId, error);
    }
  }

  const remainingCount = Math.max(0, (await FollowUp.countDocuments(query)) - followUps.length);

  return {
    batchCount: followUps.length ? 1 : 0,
    failedCount,
    hasMore: remainingCount > 0,
    metadata: { dayKey, end, eventsCreated, remainingCount, start },
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
