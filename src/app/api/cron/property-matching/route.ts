import { jsonError, jsonOk } from "@/lib/api";
import { isValidCronRequest } from "@/services/automation/cron-auth";
import { runAutomationJob } from "@/services/automation/automation-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return jsonError("UNAUTHORIZED", "Unauthorized.", 401);
  return jsonOk(await runAutomationJob("NEW_PROPERTY_MATCHING", "CRON"));
}
