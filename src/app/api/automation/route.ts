import { handleApiError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getAutomationDashboardData } from "@/services/automation/automation.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 20);

    return jsonOk(await getAutomationDashboardData(page, limit));
  } catch (error) {
    return handleApiError(error);
  }
}
