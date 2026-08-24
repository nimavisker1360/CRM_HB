import { handleApiError, jsonOk } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { assertCanAccessScopedRecord, agentScopeFilter, getAgentScope, resolveRequestedAgentId } from "@/lib/auth/agent-scope";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { cleanObject, dateRangeForDay, getPagination, objectIdOrUndefined, paginationMeta } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { followUpSchema } from "@/lib/validators";
import { Customer, FollowUp } from "@/models";
import { createFollowUpCreatedNotification } from "@/services/notifications/notification.service";
import { publishRealtimeEvent } from "@/services/realtime/realtime-bus";

export const dynamic = "force-dynamic";

function followUpStatusFilter(bucket: string | null) {
  const now = new Date();
  const today = dateRangeForDay(now);

  if (bucket === "today") {
    return { scheduledAt: { $gte: today.start, $lt: today.end } };
  }
  if (bucket === "upcoming") {
    return { scheduledAt: { $gte: today.end }, status: "PENDING" };
  }
  if (bucket === "overdue") {
    return { scheduledAt: { $lt: now }, status: "PENDING" };
  }
  return {};
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { limit, page, skip } = getPagination(searchParams);
    const scope = getAgentScope(session, resolveRequestedAgentId(searchParams));
    const query: Record<string, unknown> = {
      ...agentScopeFilter(scope, "agentId"),
      ...followUpStatusFilter(searchParams.get("bucket")),
    };

    const status = searchParams.get("status");
    const customerId = objectIdOrUndefined(searchParams.get("customerId"));
    const agentId = objectIdOrUndefined(searchParams.get("agentId"));

    if (status) query.status = status;
    if (customerId) query.customerId = customerId;
    if (agentId && !scope.effectiveAgentId) query.agentId = agentId;

    const [items, total] = await Promise.all([
      FollowUp.find(query)
        .sort({ scheduledAt: 1, dueAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate("customerId", "fullName phone status")
        .populate("agentId", "fullName name")
        .lean(),
      FollowUp.countDocuments(query),
    ]);

    return jsonOk({ items: serializeMongo(items), pagination: paginationMeta(total, page, limit) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN", "MANAGER", "AGENT"]);
    await connectToDatabase();

    const parsed = followUpSchema.parse(await request.json());
    const customer = await Customer.findById(parsed.customerId).select("assignedAgentId assignedAgent fullName name").lean();
    if (!customer) throw new Error("FORBIDDEN");
    assertCanAccessScopedRecord(session, customer);
    const scope = getAgentScope(session, parsed.agentId || String(customer.assignedAgentId || customer.assignedAgent || ""));
    const agentId = scope.effectiveAgentId || parsed.agentId || String(customer.assignedAgentId || customer.assignedAgent || "");
    const followUp = await FollowUp.create(
      cleanObject({
        ...parsed,
        agentId,
        assignedAgent: agentId,
        channel: parsed.type === "PROPERTY_VISIT" || parsed.type === "OTHER" ? "MEETING" : parsed.type,
        customer: parsed.customerId,
        dueAt: parsed.scheduledAt,
        notes: parsed.note,
        title: `${parsed.type} follow-up`,
        createdBy: session.userId,
      }),
    );

    await logActivity({
      action: "CREATED",
      description: `${session.name} created a follow-up.`,
      entityId: String(followUp._id),
      entityType: "FOLLOW_UP",
      metadata: { customerId: parsed.customerId },
      scope,
      session,
    });

    await createFollowUpCreatedNotification({
      agentId,
      customerId: parsed.customerId,
      customerName: String(customer.fullName || customer.name || ""),
      dueAt: parsed.scheduledAt,
      followUpId: followUp._id,
    });

    await publishRealtimeEvent({
      agentId: agentId ? String(agentId) : undefined,
      followUpId: String(followUp._id),
      resource: "follow-ups",
      type: "followup.created",
    });

    return jsonOk(serializeMongo(followUp), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
