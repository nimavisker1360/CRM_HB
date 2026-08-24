import { handleApiError, jsonOk } from "@/lib/api";
import { getAgentScope, resolveRequestedAgentId } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { markAllAsRead } from "@/services/notifications/notification.service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const scope = getAgentScope(session, resolveRequestedAgentId(searchParams));
    return jsonOk(
      await markAllAsRead({
        filters: { agentId: searchParams.get("agentId") || undefined },
        scope,
        session,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
