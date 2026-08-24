import { handleApiError, jsonOk } from "@/lib/api";
import { getAgentScope, resolveRequestedAgentId } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { getUnreadCount } from "@/services/notifications/notification.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const scope = getAgentScope(session, resolveRequestedAgentId(searchParams));
    const count = await getUnreadCount({
      filters: { agentId: searchParams.get("agentId") || undefined },
      scope,
      session,
    });

    return jsonOk({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
