import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { assertCanAccessScopedRecord } from "@/lib/auth/agent-scope";
import { canManageAll, requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { cleanObject, objectIdOrUndefined } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { followUpSchema } from "@/lib/validators";
import { Customer, FollowUp } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await connectToDatabase();
    const { id } = await context.params;
    const _id = objectIdOrUndefined(id);

    if (!_id) return jsonError("FOLLOW_UP_NOT_FOUND", "Follow-up not found.", 404);

    const followUp = await FollowUp.findById(_id)
      .populate("customerId", "fullName phone status")
      .populate("agentId", "fullName name")
      .lean();

    if (!followUp) return jsonError("FOLLOW_UP_NOT_FOUND", "Follow-up not found.", 404);
    if (!canManageAll(session)) assertCanAccessScopedRecord(session, followUp);

    return jsonOk(serializeMongo(followUp));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await connectToDatabase();
    const { id } = await context.params;
    const _id = objectIdOrUndefined(id);

    if (!_id) return jsonError("FOLLOW_UP_NOT_FOUND", "Follow-up not found.", 404);

    const parsed = followUpSchema.partial().parse(await request.json());
    if (!canManageAll(session) && parsed.agentId) {
      throw new Error("FORBIDDEN");
    }
    if (!canManageAll(session) && parsed.customerId) {
      const customer = await Customer.findById(parsed.customerId).select("assignedAgentId assignedAgent").lean();
      if (!customer) throw new Error("FORBIDDEN");
      assertCanAccessScopedRecord(session, customer);
    }

    const query = canManageAll(session) ? { _id } : { _id, agentId: session.agentId || "__no_agent__" };
    const statusPayload =
      parsed.status === "COMPLETED" ? { completedAt: new Date(), status: "COMPLETED" } : {};
    const followUp = await FollowUp.findOneAndUpdate(
      query,
      cleanObject({
        ...parsed,
        ...statusPayload,
        assignedAgent: parsed.agentId,
        channel: parsed.type && parsed.type !== "PROPERTY_VISIT" && parsed.type !== "OTHER" ? parsed.type : undefined,
        customer: parsed.customerId,
        dueAt: parsed.scheduledAt,
        notes: parsed.note,
        title: parsed.type ? `${parsed.type} follow-up` : undefined,
      }),
      { returnDocument: "after", runValidators: true },
    );

    if (!followUp) return jsonError("FOLLOW_UP_NOT_FOUND", "Follow-up not found.", 404);

    await logActivity({
      action: parsed.status === "COMPLETED" ? "COMPLETED" : "UPDATED",
      description: `${session.name} ${parsed.status === "COMPLETED" ? "completed" : "updated"} a follow-up.`,
      entityId: String(followUp._id),
      entityType: "FOLLOW_UP",
      session,
    });

    return jsonOk(serializeMongo(followUp));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();
    const { id } = await context.params;
    const _id = objectIdOrUndefined(id);

    if (!_id) return jsonError("FOLLOW_UP_NOT_FOUND", "Follow-up not found.", 404);

    const existingFollowUp = await FollowUp.findById(_id).lean();
    if (!existingFollowUp) return jsonError("FOLLOW_UP_NOT_FOUND", "Follow-up not found.", 404);
    assertCanAccessScopedRecord(session, existingFollowUp);

    const followUp = await FollowUp.findByIdAndDelete(_id);
    if (!followUp) return jsonError("FOLLOW_UP_NOT_FOUND", "Follow-up not found.", 404);

    await logActivity({
      action: "DELETED",
      description: `${session.name} deleted a follow-up.`,
      entityId: String(followUp._id),
      entityType: "FOLLOW_UP",
      metadata: { customerId: String(followUp.customerId || followUp.customer || "") },
      session,
    });

    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
