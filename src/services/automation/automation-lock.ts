import { AUTOMATION_LOCK_TTL_MS } from "@/services/automation/automation.config";
import { AutomationLock } from "@/models";

export async function acquireAutomationLock(jobName: string, runId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTOMATION_LOCK_TTL_MS);

  try {
    const lock = await AutomationLock.findOneAndUpdate(
      {
        jobName,
        $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
      },
      { $set: { expiresAt, lockedAt: now, runId }, $setOnInsert: { jobName } },
      { new: true, setDefaultsOnInsert: true, upsert: true },
    ).lean();

    return lock?.runId === runId;
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) return false;
    throw error;
  }
}

export async function releaseAutomationLock(jobName: string, runId: string) {
  await AutomationLock.deleteOne({ jobName, runId });
}
