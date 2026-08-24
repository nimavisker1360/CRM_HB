import { handleApiError, jsonOk } from "@/lib/api";
import { getAgentScope, resolveRequestedAgentId } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { getNotifications } from "@/services/notifications/notification.service";
import type {
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from "@/services/notifications/notification.types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const scope = getAgentScope(session, resolveRequestedAgentId(searchParams));

    return jsonOk(
      await getNotifications({
        filters: {
          agentId: searchParams.get("agentId") || undefined,
          category: (searchParams.get("category") || undefined) as NotificationCategory | undefined,
          limit: Number(searchParams.get("limit") || 20),
          page: Number(searchParams.get("page") || 1),
          priority: (searchParams.get("priority") || undefined) as NotificationPriority | undefined,
          q: searchParams.get("q")?.trim() || undefined,
          status: ((searchParams.get("status") || undefined) as NotificationStatus | undefined) || undefined,
          type: (searchParams.get("type") || undefined) as NotificationType | undefined,
        },
        scope,
        session,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
