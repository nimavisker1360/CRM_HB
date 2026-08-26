import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { firstParam, getAgentScope } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import {
  archiveNotification,
  deleteNotification,
  markNotificationAsRead,
} from "@/services/notifications/notification.service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const scope = getAgentScope(session, firstParam(searchParams.get("agentId")));
    const body = (await request.json().catch(() => ({}))) as { action?: string };

    if (body.action === "archive") {
      return jsonOk(await archiveNotification(id, { scope, session }));
    }

    if (!body.action || body.action === "read") {
      return jsonOk(await markNotificationAsRead(id, { scope, session }));
    }

    return jsonError("INVALID_ACTION", "Invalid notification action.", 422);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const scope = getAgentScope(session, firstParam(searchParams.get("agentId")));

    return jsonOk(await deleteNotification(id, { scope, session }));
  } catch (error) {
    return handleApiError(error);
  }
}
