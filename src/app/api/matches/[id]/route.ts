import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { assertCanAccessScopedRecord } from "@/lib/auth/agent-scope";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { PropertyMatch } from "@/models";
import { MATCH_STATUSES } from "@/services/matching/matching.config";
import { isValidMatchTransition } from "@/services/matching/matching.service";
import type { MatchStatus } from "@/services/matching/matching.types";

export const dynamic = "force-dynamic";

function accessQuery(id: string) {
  const _id = objectIdOrUndefined(id);
  if (!_id) return null;
  return { _id };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await connectToDatabase();
    const { id } = await context.params;
    const query = accessQuery(id);

    if (!query) return jsonError("MATCH_NOT_FOUND", "Match not found.", 404);

    const match = await PropertyMatch.findOne(query)
      .populate("customerId", "fullName phone status maxBudget minBudget currency interestedCity interestedDistrict")
      .populate({
        path: "propertyId",
        populate: { path: "projectId", select: "name developer" },
      })
      .populate("agentId", "fullName name email phone")
      .lean();

    if (!match) return jsonError("MATCH_NOT_FOUND", "Match not found.", 404);
    assertCanAccessScopedRecord(session, match);

    return jsonOk(serializeMongo(match));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await connectToDatabase();
    const { id } = await context.params;
    const query = accessQuery(id);

    if (!query) return jsonError("MATCH_NOT_FOUND", "Match not found.", 404);

    const body = (await request.json()) as { status?: string };
    const nextStatus = body.status as MatchStatus;
    if (!MATCH_STATUSES.includes(nextStatus)) {
      return jsonError("INVALID_STATUS", "Invalid match status.", 422);
    }

    const match = await PropertyMatch.findOne(query);
    if (!match) return jsonError("MATCH_NOT_FOUND", "Match not found.", 404);
    assertCanAccessScopedRecord(session, match);

    if (match.status !== nextStatus && !isValidMatchTransition(match.status as MatchStatus, nextStatus)) {
      return jsonError("INVALID_TRANSITION", "Match status transition is not allowed.", 422);
    }

    match.status = nextStatus;
    await match.save();

    return jsonOk(serializeMongo(match));
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
    const query = accessQuery(id);

    if (!query) return jsonError("MATCH_NOT_FOUND", "Match not found.", 404);

    const existingMatch = await PropertyMatch.findOne(query).lean();
    if (!existingMatch) return jsonError("MATCH_NOT_FOUND", "Match not found.", 404);
    assertCanAccessScopedRecord(session, existingMatch);

    const match = await PropertyMatch.findOneAndDelete(query);
    if (!match) return jsonError("MATCH_NOT_FOUND", "Match not found.", 404);

    await logActivity({
      action: "DELETED",
      description: `${session.name} deleted match ${match._id}.`,
      entityId: String(match._id),
      entityType: "MATCH",
      metadata: {
        customerId: String(match.customerId),
        propertyId: String(match.propertyId),
        score: match.score,
      },
      session,
    });

    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
