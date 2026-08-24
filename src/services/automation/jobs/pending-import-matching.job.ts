import { Types } from "mongoose";
import { Customer, ImportJob, Property } from "@/models";
import { recalculateCustomerMatches, recalculatePropertyMatches } from "@/services/matching/matching.service";
import type { AutomationJobContext, AutomationJobResult } from "@/services/automation/automation.types";

type IdRecord = { _id: Types.ObjectId };

export async function runPendingImportMatchingJob(context: AutomationJobContext): Promise<AutomationJobResult> {
  const importJobs = await ImportJob.find({
    matchingPending: true,
    $or: [
      { matchingStatus: { $in: ["PENDING", "PROCESSING", "PARTIAL", "FAILED"] } },
      { matchingStatus: { $exists: false } },
    ],
    status: { $in: ["COMPLETED", "PARTIAL"] },
  })
    .sort({ createdAt: 1 })
    .limit(context.batchSize)
    .select("_id kind entityType matchingProcessedCount")
    .lean<Array<IdRecord & { entityType?: string; kind?: string; matchingProcessedCount?: number }>>();

  let batchCount = 0;
  let failedCount = 0;
  let processedCount = 0;
  let savedMatches = 0;
  let successCount = 0;
  let skippedCount = 0;
  const processedImportJobs: string[] = [];

  for (const importJob of importJobs) {
    if (processedCount >= context.maxItems) break;
    const entityType = importJob.entityType || importJob.kind;

    if (entityType !== "CUSTOMERS" && entityType !== "PROPERTIES") {
      skippedCount += 1;
      await ImportJob.updateOne(
        { _id: importJob._id },
        {
          $set: {
            matchingCompletedAt: new Date(),
            matchingPending: false,
            matchingStatus: "NOT_REQUIRED",
          },
        },
      );
      continue;
    }

    await ImportJob.updateOne(
      { _id: importJob._id },
      { $set: { matchingStartedAt: new Date(), matchingStatus: "PROCESSING" } },
    );
    processedImportJobs.push(String(importJob._id));

    const model = entityType === "CUSTOMERS" ? Customer : Property;
    const records = await model
      .find({ importJobId: importJob._id, matchingPending: true })
      .sort({ _id: 1 })
      .limit(context.maxItems - processedCount)
      .select("_id")
      .lean<IdRecord[]>();

    if (records.length) batchCount += 1;

    for (const record of records) {
      processedCount += 1;
      try {
        const result =
          entityType === "CUSTOMERS"
            ? await recalculateCustomerMatches(record._id, context.batchSize)
            : await recalculatePropertyMatches(record._id, context.batchSize);
        savedMatches += result.saved;
        successCount += 1;
      } catch (error) {
        failedCount += 1;
        await model.updateOne(
          { _id: record._id },
          { $set: { matchingPending: true, matchingRequiredAt: new Date() } },
        );
        console.error("[pending-import-matching]", context.runId, error);
      }
    }

    const remainingForJob = await model.countDocuments({ importJobId: importJob._id, matchingPending: true });
    const nextStatus = failedCount > 0 && successCount === 0 ? "FAILED" : remainingForJob > 0 ? "PARTIAL" : "COMPLETED";
    await ImportJob.updateOne(
      { _id: importJob._id },
      {
        $inc: { matchingProcessedCount: records.length },
        $set: {
          matchingCompletedAt: remainingForJob > 0 ? undefined : new Date(),
          matchingPending: remainingForJob > 0,
          matchingStatus: nextStatus,
        },
      },
    );
  }

  const remainingCount = await ImportJob.countDocuments({
    matchingPending: true,
    $or: [
      { matchingStatus: { $in: ["PENDING", "PROCESSING", "PARTIAL", "FAILED"] } },
      { matchingStatus: { $exists: false } },
    ],
  });

  return {
    batchCount,
    failedCount,
    hasMore: remainingCount > 0,
    metadata: { processedImportJobs, remainingCount, savedMatches },
    processedCount,
    skippedCount,
    successCount,
  };
}
