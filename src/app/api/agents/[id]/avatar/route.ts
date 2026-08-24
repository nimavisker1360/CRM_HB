import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { Agent } from "@/models";
import { publishRealtimeEvent } from "@/services/realtime/realtime-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);

    const { id } = await context.params;
    const _id = objectIdOrUndefined(id);
    if (!_id) return jsonError("AGENT_NOT_FOUND", "Agent not found.", 404);

    const formData = await request.formData();
    const avatar = formData.get("avatar");
    if (!(avatar instanceof File)) {
      return jsonError("AVATAR_REQUIRED", "An avatar image is required.", 422);
    }
    if (!ACCEPTED_IMAGE_TYPES.has(avatar.type)) {
      return jsonError("INVALID_AVATAR_TYPE", "Only JPEG, PNG, and WebP images are allowed.", 415);
    }
    if (avatar.size <= 0 || avatar.size > MAX_AVATAR_BYTES) {
      return jsonError("AVATAR_TOO_LARGE", "The processed avatar must be smaller than 1 MB.", 413);
    }

    const avatarDataUrl = `data:${avatar.type};base64,${Buffer.from(await avatar.arrayBuffer()).toString("base64")}`;

    await connectToDatabase();
    const agent = await Agent.findByIdAndUpdate(
      _id,
      { avatarDataUrl },
      { returnDocument: "after", runValidators: true },
    );
    if (!agent) return jsonError("AGENT_NOT_FOUND", "Agent not found.", 404);

    await logActivity({
      action: "UPDATED",
      description: `${session.name} updated the profile photo for ${agent.fullName}.`,
      entityId: String(agent._id),
      entityType: "AGENT",
      metadata: { activityKey: "AGENT_AVATAR_UPDATED", actorName: session.name, subjectName: agent.fullName },
      session,
    });
    await publishRealtimeEvent({
      agentId: String(agent._id),
      resource: "agents",
      type: "agent.avatar.updated",
      userId: agent.userId ? String(agent.userId) : agent.user ? String(agent.user) : undefined,
    });

    return jsonOk(serializeMongo(agent));
  } catch (error) {
    return handleApiError(error);
  }
}
