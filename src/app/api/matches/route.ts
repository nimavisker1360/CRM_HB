import { handleApiError, jsonOk } from "@/lib/api";
import { agentScopeFilter, getAgentScope, resolveRequestedAgentId } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { escapeRegex, getPagination, objectIdOrUndefined, paginationMeta } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { Customer, Property, PropertyMatch } from "@/models";
import { MATCH_MIN_SCORE } from "@/services/matching/matching.config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { limit, page, skip } = getPagination(searchParams);
    const q = searchParams.get("q")?.trim();
    const scope = getAgentScope(session, resolveRequestedAgentId(searchParams));
    const query: Record<string, unknown> = {
      ...agentScopeFilter(scope, "agentId"),
      score: { $gte: Number(searchParams.get("minScore") || MATCH_MIN_SCORE) },
    };

    const status = searchParams.get("status");
    query.status = status || { $ne: "ARCHIVED" };

    const agentId = objectIdOrUndefined(searchParams.get("agentId"));
    const customerId = objectIdOrUndefined(searchParams.get("customerId"));
    const propertyId = objectIdOrUndefined(searchParams.get("propertyId"));
    if (agentId && !scope.effectiveAgentId) query.agentId = agentId;
    if (customerId) query.customerId = customerId;
    if (propertyId) query.propertyId = propertyId;

    const date = searchParams.get("date");
    if (date) {
      const start = new Date(date);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      query.createdAt = { $gte: start, $lt: end };
    }

    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      const [customers, properties] = await Promise.all([
        Customer.find({ $or: [{ fullName: regex }, { phone: regex }, { email: regex }] }).select("_id").lean(),
        Property.find({ $or: [{ title: regex }, { propertyCode: regex }, { city: regex }, { district: regex }] })
          .select("_id")
          .lean(),
      ]);
      query.$or = [
        { customerId: { $in: customers.map((customer) => customer._id) } },
        { propertyId: { $in: properties.map((property) => property._id) } },
      ];
    }

    const [items, total] = await Promise.all([
      PropertyMatch.find(query)
        .sort({ score: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("customerId", "fullName phone status assignedAgentId")
        .populate("propertyId", "title propertyCode city district price currency rooms grossArea")
        .populate("agentId", "fullName name email")
        .lean(),
      PropertyMatch.countDocuments(query),
    ]);

    return jsonOk({ items: serializeMongo(items), pagination: paginationMeta(total, page, limit) });
  } catch (error) {
    return handleApiError(error);
  }
}
