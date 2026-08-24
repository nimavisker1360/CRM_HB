import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { syncUserForAgentProfile } from "@/lib/auth/users";
import { cleanObject, objectIdOrUndefined } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { agentSchema } from "@/lib/validators";
import {
  Activity,
  Agent,
  AIConversation,
  AIMessage,
  AIUsage,
  AutomationJob,
  Customer,
  FollowUp,
  ImportJob,
  Notification,
  Project,
  Property,
  PropertyMatch,
  RealtimeEvent,
  User,
  WhatsAppMessage,
} from "@/models";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();
    const { id } = await context.params;
    const _id = objectIdOrUndefined(id);

    if (!_id) return jsonError("AGENT_NOT_FOUND", "Agent not found.", 404);

    const agent = await Agent.findById(_id).lean();
    if (!agent) return jsonError("AGENT_NOT_FOUND", "Agent not found.", 404);

    return jsonOk(serializeMongo(agent));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();
    const { id } = await context.params;
    const _id = objectIdOrUndefined(id);

    if (!_id) return jsonError("AGENT_NOT_FOUND", "Agent not found.", 404);

    const parsed = agentSchema.partial().parse(await request.json());
    const payload = cleanObject({ ...parsed, name: parsed.fullName });
    const agent = await Agent.findByIdAndUpdate(_id, payload, { returnDocument: "after", runValidators: true });

    if (!agent) return jsonError("AGENT_NOT_FOUND", "Agent not found.", 404);

    const user = await syncUserForAgentProfile({
      email: agent.email,
      fullName: agent.fullName,
      password: parsed.password,
      phone: agent.phone,
      role: agent.role,
      status: agent.status,
    }, agent.userId || agent.user);
    agent.user = user._id;
    agent.userId = user._id;
    await agent.save();

    await logActivity({
      action: "UPDATED",
      description: `${session.name} updated agent ${agent.fullName}.`,
      entityId: String(agent._id),
      entityType: "AGENT",
      metadata: { activityKey: "AGENT_UPDATED", actorName: session.name, subjectName: agent.fullName },
      session,
    });

    return jsonOk(serializeMongo(agent));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();
    const { id } = await context.params;
    const _id = objectIdOrUndefined(id);
    const permanent = new URL(request.url).searchParams.get("permanent") === "true";

    if (!_id) return jsonError("AGENT_NOT_FOUND", "Agent not found.", 404);

    const agent = await Agent.findById(_id);
    if (!agent) return jsonError("AGENT_NOT_FOUND", "Agent not found.", 404);

    const body = await request.json().catch(() => ({})) as { confirmation?: unknown };
    const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
    if (!confirmation || confirmation.toLocaleLowerCase() !== agent.fullName.trim().toLocaleLowerCase()) {
      return jsonError("AGENT_CONFIRMATION_REQUIRED", "The agent full name must be entered to confirm this action.", 400);
    }

    const linkedUserId = agent.userId || agent.user;
    const isCurrentAccount = agent.email.toLocaleLowerCase() === session.email.toLocaleLowerCase()
      || (linkedUserId && String(linkedUserId) === session.userId);
    if (isCurrentAccount) {
      return permanent
        ? jsonError("AGENT_SELF_DELETE_FORBIDDEN", "You cannot permanently delete your own account.", 409)
        : jsonError("AGENT_SELF_SUSPEND_FORBIDDEN", "You cannot suspend your own account.", 409);
    }

    if (agent.role === "ADMIN" && agent.status !== "SUSPENDED" && agent.isActive !== false) {
      const activeAdminCount = await Agent.countDocuments({
        isActive: { $ne: false },
        role: "ADMIN",
        status: { $ne: "SUSPENDED" },
      });
      if (activeAdminCount <= 1) {
        return jsonError("LAST_ADMIN_SUSPEND_FORBIDDEN", "The last active administrator cannot be suspended.", 409);
      }
    }

    if (permanent) {
      if (agent.status !== "SUSPENDED" || agent.isActive !== false) {
        return jsonError("AGENT_PERMANENT_DELETE_REQUIRES_SUSPENSION", "Suspend the agent before permanent deletion.", 409);
      }

      const sharedUser = linkedUserId
        ? await Agent.exists({
            _id: { $ne: _id },
            $or: [{ userId: linkedUserId }, { user: linkedUserId }],
          })
        : null;
      const shouldDeleteUser = Boolean(linkedUserId && !sharedUser);

      await Promise.all([
        Customer.updateMany({ $or: [{ assignedAgentId: _id }, { assignedAgent: _id }] }, { $unset: { assignedAgentId: "", assignedAgent: "" } }),
        Property.updateMany({ $or: [{ assignedAgentId: _id }, { assignedAgent: _id }] }, { $unset: { assignedAgentId: "", assignedAgent: "" } }),
        FollowUp.updateMany({ $or: [{ agentId: _id }, { assignedAgent: _id }] }, { $unset: { agentId: "", assignedAgent: "" } }),
        PropertyMatch.updateMany({ agentId: _id }, { $unset: { agentId: "" } }),
        Project.updateMany({ assignedAgents: _id }, { $pull: { assignedAgents: _id } }),
        WhatsAppMessage.updateMany({ agentId: _id }, { $unset: { agentId: "" } }),
        Notification.deleteMany({ $or: [{ agentId: _id }, { recipientAgentId: _id }] }),
        AIUsage.deleteMany({ agentId: _id }),
        RealtimeEvent.deleteMany({ agentId: String(_id) }),
      ]);

      if (shouldDeleteUser && linkedUserId) {
        const conversations = await AIConversation.find({
          $or: [{ agentId: _id }, { userId: linkedUserId }],
        }).select("_id").lean();
        const conversationIds = conversations.map((conversation) => conversation._id);

        await Promise.all([
          conversationIds.length ? AIMessage.deleteMany({ conversationId: { $in: conversationIds } }) : Promise.resolve(),
          AIConversation.deleteMany({ $or: [{ agentId: _id }, { userId: linkedUserId }] }),
          AIUsage.deleteMany({ $or: [{ agentId: _id }, { userId: linkedUserId }] }),
          Notification.deleteMany({ $or: [{ recipientUserId: linkedUserId }, { user: linkedUserId }, { userId: linkedUserId }] }),
          Customer.updateMany({ createdBy: linkedUserId }, { $unset: { createdBy: "" } }),
          Property.updateMany({ createdBy: linkedUserId }, { $unset: { createdBy: "" } }),
          FollowUp.updateMany({ createdBy: linkedUserId }, { $unset: { createdBy: "" } }),
          WhatsAppMessage.updateMany({ createdBy: linkedUserId }, { $unset: { createdBy: "" } }),
          ImportJob.updateMany({ createdBy: linkedUserId }, { $unset: { createdBy: "" } }),
          AutomationJob.updateMany({ initiatedBy: linkedUserId }, { $unset: { initiatedBy: "" } }),
          Activity.updateMany({ $or: [{ actorId: linkedUserId }, { actor: linkedUserId }] }, { $unset: { actorId: "", actor: "" } }),
          RealtimeEvent.deleteMany({ userId: String(linkedUserId) }),
        ]);
      }

      await Agent.deleteOne({ _id });
      if (shouldDeleteUser && linkedUserId) await User.deleteOne({ _id: linkedUserId });

      await logActivity({
        action: "DELETED",
        description: `${session.name} permanently deleted agent ${agent.fullName}.`,
        entityId: String(agent._id),
        entityType: "AGENT",
        metadata: {
          activityKey: "AGENT_DELETED",
          actorName: session.name,
          email: agent.email,
          permanent: true,
          subjectName: agent.fullName,
        },
        session,
      });

      return jsonOk({ deleted: true, permanent: true });
    }

    agent.isActive = false;
    agent.status = "SUSPENDED";
    await agent.save();
    if (linkedUserId) await User.updateOne({ _id: linkedUserId }, { status: "SUSPENDED" });

    await logActivity({
      action: "ARCHIVED",
      description: `${session.name} suspended agent ${agent.fullName}.`,
      entityId: String(agent._id),
      entityType: "AGENT",
      metadata: { activityKey: "AGENT_SUSPENDED", actorName: session.name, subjectName: agent.fullName },
      session,
    });

    return jsonOk({ archived: true, deleted: false, suspended: true });
  } catch (error) {
    return handleApiError(error);
  }
}
