import { Types } from "mongoose";
import { Customer } from "@/models";
import { MATCHING_VERSION, ACTIVE_CUSTOMER_STATUSES } from "@/services/matching/matching.config";
import { recalculateCustomerMatches } from "@/services/matching/matching.service";
import type { AutomationJobContext, AutomationJobResult } from "@/services/automation/automation.types";

type IdRecord = { _id: Types.ObjectId };

export async function runDailyMatchingJob(context: AutomationJobContext): Promise<AutomationJobResult> {
  const baseQuery = {
    status: { $in: ACTIVE_CUSTOMER_STATUSES },
    $or: [
      { matchingPending: true },
      { lastMatchedAt: { $exists: false } },
      { matchCalculationVersion: { $ne: MATCHING_VERSION } },
    ],
  };
  let batchCount = 0;
  let failedCount = 0;
  let processedCount = 0;
  let savedMatches = 0;
  const skippedCount = 0;
  let successCount = 0;
  let lastProcessedId: Types.ObjectId | undefined;

  while (processedCount < context.maxItems) {
    const remaining = context.maxItems - processedCount;
    const query = lastProcessedId ? { ...baseQuery, _id: { $gt: lastProcessedId } } : baseQuery;
    const customers = await Customer.find(query)
      .sort({ _id: 1 })
      .limit(Math.min(context.batchSize, remaining))
      .select("_id")
      .lean<IdRecord[]>();

    if (!customers.length) break;
    batchCount += 1;

    for (const customer of customers) {
      lastProcessedId = customer._id;
      processedCount += 1;
      try {
        const result = await recalculateCustomerMatches(customer._id, context.batchSize);
        savedMatches += result.saved;
        successCount += 1;
      } catch (error) {
        failedCount += 1;
        await Customer.updateOne(
          { _id: customer._id },
          { $set: { matchingPending: true, matchingRequiredAt: new Date() } },
        );
        console.error("[daily-matching]", context.runId, error);
      }
    }
  }

  const remainingCount = await Customer.countDocuments(baseQuery);

  return {
    batchCount,
    failedCount,
    hasMore: remainingCount > 0,
    metadata: {
      lastProcessedId: lastProcessedId ? String(lastProcessedId) : undefined,
      matchCalculationVersion: MATCHING_VERSION,
      remainingCount,
      savedMatches,
    },
    processedCount,
    skippedCount,
    successCount,
  };
}
