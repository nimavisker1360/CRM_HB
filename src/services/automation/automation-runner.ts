import { randomUUID } from "crypto";
import { logActivity } from "@/lib/activity";
import type { SessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { AutomationJob } from "@/models";
import {
  AUTOMATION_BATCH_SIZE,
  AUTOMATION_DEFINITIONS,
  AUTOMATION_MAX_ITEMS_PER_RUN,
  INACTIVE_CUSTOMER_DAYS,
} from "@/services/automation/automation.config";
import { createAutomationEvent } from "@/services/automation/automation-events";
import { acquireAutomationLock, releaseAutomationLock } from "@/services/automation/automation-lock";
import type {
  AutomationJobResult,
  AutomationJobType,
  AutomationStatus,
  AutomationTriggerType,
} from "@/services/automation/automation.types";

function statusForResult(result: AutomationJobResult): AutomationStatus {
  if ((result.failedCount || 0) > 0 && (result.successCount || 0) === 0) return "FAILED";
  if ((result.failedCount || 0) > 0 || result.hasMore) return "PARTIAL";
  return "SUCCESS";
}

function publicResult(job: Record<string, unknown>) {
  return {
    batchCount: Number(job.batchCount || 0),
    completedAt: job.completedAt,
    failedCount: Number(job.failedCount || 0),
    job: job.type,
    processed: Number(job.processedCount || 0),
    runId: job.runId,
    status: job.status,
    success: job.status === "SUCCESS" || job.status === "PARTIAL",
    successCount: Number(job.successCount || 0),
  };
}

export async function runAutomationJob(
  type: AutomationJobType,
  triggerType: AutomationTriggerType,
  initiatedBy?: SessionUser,
) {
  await connectToDatabase();
  const definition = AUTOMATION_DEFINITIONS[type];
  const runId = `${type}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const startedAt = new Date();
  const job = await AutomationJob.create({
    initiatedBy: initiatedBy?.userId,
    name: definition.name,
    runId,
    schedule: definition.schedule,
    startedAt,
    status: "PENDING",
    triggerType,
    type,
  });

  const hasLock = await acquireAutomationLock(type, runId);
  if (!hasLock) {
    const completedAt = new Date();
    await AutomationJob.updateOne(
      { _id: job._id },
      {
        $set: {
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          errorMessage: "Job is already running.",
          skippedCount: 1,
          status: "CANCELLED",
        },
      },
    );
    const cancelled = await AutomationJob.findById(job._id).lean<Record<string, unknown>>();
    return publicResult(cancelled || {});
  }

  try {
    await AutomationJob.updateOne({ _id: job._id }, { $set: { status: "RUNNING" } });
    if (initiatedBy) {
      await logActivity({
        action: "STARTED",
        description: `${initiatedBy.name} manually started ${type}.`,
        entityId: String(job._id),
        entityType: "AUTOMATION_JOB",
        metadata: { runId, type },
        session: initiatedBy,
      });
    }

    const result = await definition.run({
      batchSize: AUTOMATION_BATCH_SIZE,
      inactiveCustomerDays: INACTIVE_CUSTOMER_DAYS,
      jobId: job._id,
      maxItems: AUTOMATION_MAX_ITEMS_PER_RUN,
      now: new Date(),
      runId,
    });
    const completedAt = new Date();
    const status = statusForResult(result);

    await AutomationJob.updateOne(
      { _id: job._id },
      {
        $set: {
          batchCount: result.batchCount || 0,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          errorDetails: result.errorDetails,
          errorMessage: result.errorMessage,
          failedCount: result.failedCount || 0,
          metadata: result.metadata,
          processedCount: result.processedCount || 0,
          skippedCount: result.skippedCount || 0,
          status,
          successCount: result.successCount || 0,
        },
      },
    );

    if (status === "FAILED") {
      await createAutomationEvent({
        automationJobId: job._id,
        body: `${definition.name} با خطا متوقف شد.`,
        dedupeKey: `AUTOMATION_FAILED:${String(job._id)}`,
        payload: { runId, type },
        title: "خطا در اتوماسیون",
        type: "AUTOMATION_FAILED",
      });
    } else if (status === "PARTIAL") {
      await createAutomationEvent({
        automationJobId: job._id,
        body: `${definition.name} با ${result.failedCount || 0} خطا یا آیتم باقی‌مانده تمام شد.`,
        dedupeKey: `AUTOMATION_PARTIAL:${String(job._id)}`,
        payload: { runId, type },
        title: "اتوماسیون ناقص انجام شد",
        type: "AUTOMATION_PARTIAL",
      });
    }

    await logActivity({
      action: "COMPLETED",
      description: `${definition.name} completed with status ${status}.`,
      entityId: String(job._id),
      entityType: "AUTOMATION_JOB",
      metadata: { processedCount: result.processedCount || 0, runId, status, type },
      session: initiatedBy,
    });

    const completed = await AutomationJob.findById(job._id).lean<Record<string, unknown>>();
    return publicResult(completed || {});
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : "Automation job failed.";
    await AutomationJob.updateOne(
      { _id: job._id },
      {
        $set: {
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          errorMessage: message,
          failedCount: 1,
          status: "FAILED",
        },
      },
    );
    await createAutomationEvent({
      automationJobId: job._id,
      body: message,
      dedupeKey: `AUTOMATION_FAILED:${String(job._id)}`,
      payload: { runId, type },
      title: "خطا در اتوماسیون",
      type: "AUTOMATION_FAILED",
    });
    console.error(`[${type}]`, runId, error);
    const failed = await AutomationJob.findById(job._id).lean<Record<string, unknown>>();
    return publicResult(failed || {});
  } finally {
    await releaseAutomationLock(type, runId);
  }
}
