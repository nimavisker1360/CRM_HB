import { Customer } from "@/models";
import { createAutomationEvent } from "@/services/automation/automation-events";
import { inactiveCustomerBaseFilter } from "@/services/automation/inactive-customer";
import type { AutomationJobContext, AutomationJobResult } from "@/services/automation/automation.types";

export async function runInactiveCustomerJob(context: AutomationJobContext): Promise<AutomationJobResult> {
  const cutoff = new Date(context.now.getTime() - context.inactiveCustomerDays * 24 * 60 * 60 * 1000);
  const query = {
    $and: [
      inactiveCustomerBaseFilter(cutoff),
      {
        $or: [
          { inactiveFlaggedAt: { $exists: false } },
          { inactiveFlaggedAt: { $lt: cutoff } },
        ],
      },
    ],
  };
  const customers = await Customer.find(query)
    .sort({ lastActivityAt: 1, updatedAt: 1, _id: 1 })
    .limit(context.maxItems)
    .select("_id assignedAgent assignedAgentId fullName lastActivityAt lastContact updatedAt")
    .lean<Array<Record<string, unknown>>>();

  let eventsCreated = 0;
  let failedCount = 0;
  let successCount = 0;

  for (const customer of customers) {
    try {
      const created = await createAutomationEvent({
        agentId: (customer.assignedAgentId || customer.assignedAgent) as never,
        automationJobId: context.jobId,
        body: `${context.inactiveCustomerDays} روز است هیچ فعالیتی برای ${String(customer.fullName || "مشتری")} ثبت نشده است.`,
        customerId: customer._id as never,
        dedupeKey: `INACTIVE_CUSTOMER:${String(customer._id)}`,
        payload: {
          cutoff,
          lastActivityAt: customer.lastActivityAt,
          lastContact: customer.lastContact,
        },
        title: "مشتری نیازمند پیگیری",
        type: "INACTIVE_CUSTOMER",
      });
      if (created) eventsCreated += 1;
      successCount += 1;
      await Customer.updateOne({ _id: customer._id }, { $set: { inactiveFlaggedAt: new Date() } });
    } catch (error) {
      failedCount += 1;
      console.error("[inactive-customer-check]", context.runId, error);
    }
  }

  const remainingCount = await Customer.countDocuments(query);

  return {
    batchCount: customers.length ? 1 : 0,
    failedCount,
    hasMore: remainingCount > 0,
    metadata: { cutoff, eventsCreated, remainingCount },
    processedCount: customers.length,
    successCount,
  };
}
