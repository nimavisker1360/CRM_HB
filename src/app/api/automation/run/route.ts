import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { runAutomationJob } from "@/services/automation/automation-runner";
import { AUTOMATION_JOB_TYPES, type AutomationJobType } from "@/services/automation/automation.types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    const body = await request.json();
    const type = body?.type as AutomationJobType | undefined;

    if (!type || !AUTOMATION_JOB_TYPES.includes(type)) {
      return jsonError("INVALID_AUTOMATION_JOB", "Automation job type is invalid.", 422);
    }

    return jsonOk(await runAutomationJob(type, "MANUAL", session));
  } catch (error) {
    return handleApiError(error);
  }
}
