import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getAutomationJobDetail } from "@/services/automation/automation.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    const { id } = await context.params;
    const job = await getAutomationJobDetail(id);

    if (!job) return jsonError("AUTOMATION_JOB_NOT_FOUND", "Automation job not found.", 404);

    return jsonOk(job);
  } catch (error) {
    return handleApiError(error);
  }
}
