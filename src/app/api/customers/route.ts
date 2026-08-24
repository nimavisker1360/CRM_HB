import { handleApiError, jsonOk } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { agentScopeFilter, getAgentScope, resolveRequestedAgentId } from "@/lib/auth/agent-scope";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { cleanObject, escapeRegex, getPagination, objectIdOrUndefined, paginationMeta } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { customerSchema } from "@/lib/validators";
import { Customer } from "@/models";
import { recalculateCustomerMatches } from "@/services/matching/matching.service";
import { createCustomerAssignedNotification } from "@/services/notifications/notification.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { limit, page, skip } = getPagination(searchParams);
    const q = searchParams.get("q")?.trim();
    const scope = getAgentScope(session, resolveRequestedAgentId(searchParams, ["assignedAgentId", "agentId", "agent"]));
    const query: Record<string, unknown> = {
      ...agentScopeFilter(scope),
    };

    for (const key of ["status", "interestedCity", "interestedDistrict", "transactionType", "propertyType"] as const) {
      const value = searchParams.get(key);
      if (value) query[key] = value;
    }

    const assignedAgentId = objectIdOrUndefined(searchParams.get("assignedAgentId"));
    if (assignedAgentId && !scope.effectiveAgentId) query.assignedAgentId = assignedAgentId;
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      query.$or = [{ fullName: regex }, { whatsapp: regex }, { phone: regex }, { email: regex }];
    }

    const [items, total] = await Promise.all([
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("assignedAgentId", "fullName name")
        .lean(),
      Customer.countDocuments(query),
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

    const parsed = customerSchema.parse(await request.json());
    const scope = getAgentScope(session, parsed.assignedAgentId);
    const assignedAgentId = scope.effectiveAgentId || parsed.assignedAgentId;
    const customer = await Customer.create(
      cleanObject({
        ...parsed,
        phone: parsed.whatsapp,
        assignedAgentId,
        assignedAgent: assignedAgentId,
        budgetMax: parsed.maxBudget,
        budgetMin: parsed.minBudget,
        createdBy: session.userId,
        lastActivityAt: parsed.lastContact || new Date(),
        matchingPending: true,
        matchingRequiredAt: new Date(),
        preferredCities: parsed.interestedCity ? [parsed.interestedCity] : [],
      }),
    );

    await logActivity({
      action: "CREATED",
      description: `${session.name} created customer ${customer.fullName}.`,
      entityId: String(customer._id),
      entityType: "CUSTOMER",
      scope,
      session,
    });
    await recalculateCustomerMatches(customer._id);
    if (assignedAgentId) {
      await createCustomerAssignedNotification({
        agentId: assignedAgentId,
        customerId: customer._id,
        customerName: customer.fullName,
      }).catch((error) => console.error("[notification:customer-assigned]", error));
    }

    return jsonOk(serializeMongo(customer), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
