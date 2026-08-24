import { jsonError, jsonOk } from "@/lib/api";
import { isValidCronRequest } from "@/services/automation/cron-auth";
import { runAutomationJob } from "@/services/automation/automation-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return jsonError("UNAUTHORIZED", "Unauthorized.", 401);
  const [due, overdue] = await Promise.all([
    runAutomationJob("FOLLOWUP_REMINDER", "CRON"),
    runAutomationJob("OVERDUE_FOLLOWUP_CHECK", "CRON"),
  ]);
  return jsonOk({ jobs: [due, overdue], success: due.success && overdue.success });
}
