import { Types } from "mongoose";
import { Property } from "@/models";
import { MATCHING_VERSION } from "@/services/matching/matching.config";
import { recalculatePropertyMatches } from "@/services/matching/matching.service";
import type { AutomationJobContext, AutomationJobResult } from "@/services/automation/automation.types";

type IdRecord = { _id: Types.ObjectId };

export async function runNewPropertyMatchingJob(context: AutomationJobContext): Promise<AutomationJobResult> {
  const baseQuery = {
    status: "ACTIVE",
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
  let successCount = 0;
  let lastProcessedId: Types.ObjectId | undefined;

  while (processedCount < context.maxItems) {
    const remaining = context.maxItems - processedCount;
    const query = lastProcessedId ? { ...baseQuery, _id: { $gt: lastProcessedId } } : baseQuery;
    const properties = await Property.find(query)
      .sort({ _id: 1 })
      .limit(Math.min(context.batchSize, remaining))
      .select("_id")
      .lean<IdRecord[]>();

    if (!properties.length) break;
    batchCount += 1;

    for (const property of properties) {
      lastProcessedId = property._id;
      processedCount += 1;
      try {
        const result = await recalculatePropertyMatches(property._id, context.batchSize);
        savedMatches += result.saved;
        successCount += 1;
      } catch (error) {
        failedCount += 1;
        await Property.updateOne(
          { _id: property._id },
          { $set: { matchingPending: true, matchingRequiredAt: new Date() } },
        );
        console.error("[new-property-matching]", context.runId, error);
      }
    }
  }

  const remainingCount = await Property.countDocuments(baseQuery);

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
    successCount,
  };
}
