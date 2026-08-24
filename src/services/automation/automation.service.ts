import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { AutomationJob, Customer, FollowUp, ImportJob, Property } from "@/models";
import { AUTOMATION_DEFINITIONS } from "@/services/automation/automation.config";
import type { AutomationJobType } from "@/services/automation/automation.types";
import { getBusinessTodayBounds } from "@/services/automation/automation-date";

export async function getAutomationDashboardData(page = 1, limit = 20) {
  await connectToDatabase();
  const skip = (page - 1) * limit;
  const types = Object.keys(AUTOMATION_DEFINITIONS) as AutomationJobType[];
  const today = getBusinessTodayBounds();

  const [latestRuns, runningJobs, failedJobs, pendingCustomers, pendingProperties, pendingImports, todayFollowUps, history, total] =
    await Promise.all([
      Promise.all(
        types.map((type) =>
          AutomationJob.findOne({ type })
            .sort({ startedAt: -1, createdAt: -1 })
            .lean<Record<string, unknown> | null>(),
        ),
      ),
      AutomationJob.countDocuments({ status: "RUNNING" }),
      AutomationJob.countDocuments({ status: "FAILED", createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
      Customer.countDocuments({ matchingPending: true }),
      Property.countDocuments({ matchingPending: true, status: "ACTIVE" }),
      ImportJob.countDocuments({
        matchingPending: true,
        $or: [
          { matchingStatus: { $in: ["PENDING", "PROCESSING", "PARTIAL", "FAILED"] } },
          { matchingStatus: { $exists: false } },
        ],
      }),
      FollowUp.countDocuments({
        status: { $in: ["PENDING", "OPEN"] },
        $or: [
          { scheduledAt: { $gte: today.start, $lt: today.end } },
          { scheduledAt: { $exists: false }, dueAt: { $gte: today.start, $lt: today.end } },
        ],
      }),
      AutomationJob.find({})
        .sort({ startedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("initiatedBy", "name email role")
        .lean(),
      AutomationJob.countDocuments({}),
    ]);

  const latestByType = new Map(latestRuns.filter(Boolean).map((job) => [String(job?.type), job]));
  const failedByType = await getConsecutiveFailures(types);
  const health = failedJobs > 0 || [...failedByType.values()].some((count) => count >= 3) ? "Warning" : "Healthy";

  return serializeMongo({
    definitions: types.map((type) => ({
      ...AUTOMATION_DEFINITIONS[type],
      lastRun: latestByType.get(type) || null,
      consecutiveFailures: failedByType.get(type) || 0,
    })),
    health,
    history,
    pagination: {
      limit,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      total,
    },
    summary: {
      failedJobs,
      lastSuccessfulRun: await AutomationJob.findOne({ status: "SUCCESS" }).sort({ completedAt: -1 }).lean(),
      pendingAutomationItems: pendingCustomers + pendingProperties + pendingImports,
      pendingCustomers,
      pendingFollowUpsToday: todayFollowUps,
      pendingImports,
      pendingProperties,
      runningJobs,
    },
  });
}

export async function getAutomationJobDetail(id: string) {
  await connectToDatabase();
  return serializeMongo(
    await AutomationJob.findById(id)
      .populate("initiatedBy", "name email role")
      .lean(),
  );
}

async function getConsecutiveFailures(types: AutomationJobType[]) {
  const pairs = await Promise.all(
    types.map(async (type) => {
      const jobs = await AutomationJob.find({ type })
        .sort({ startedAt: -1, createdAt: -1 })
        .limit(10)
        .select("status")
        .lean<Array<{ status?: string }>>();
      let failures = 0;
      for (const job of jobs) {
        if (job.status !== "FAILED") break;
        failures += 1;
      }
      return [type, failures] as const;
    }),
  );
  return new Map(pairs);
}
