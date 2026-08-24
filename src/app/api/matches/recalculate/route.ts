import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { canManageAll } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer } from "@/models";
import {
  recalculateCustomerMatches,
  recalculatePropertyMatches,
} from "@/services/matching/matching.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    await connectToDatabase();
    const body = (await request.json()) as { customerId?: string; propertyId?: string };

    if (body.customerId) {
      const customerId = objectIdOrUndefined(body.customerId);
      if (!customerId) return jsonError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
      if (!canManageAll(session)) {
        const customer = await Customer.findOne({
          _id: customerId,
          assignedAgentId: session.agentId || "__no_agent__",
        })
          .select("_id")
          .lean();
        if (!customer) return jsonError("FORBIDDEN", "You do not have access to this customer.", 403);
      }

      return jsonOk(await recalculateCustomerMatches(customerId));
    }

    if (body.propertyId) {
      if (!canManageAll(session)) {
        return jsonError("FORBIDDEN", "Only managers can recalculate property matches.", 403);
      }
      const propertyId = objectIdOrUndefined(body.propertyId);
      if (!propertyId) return jsonError("PROPERTY_NOT_FOUND", "Property not found.", 404);

      return jsonOk(await recalculatePropertyMatches(propertyId));
    }

    return jsonError("MISSING_TARGET", "customerId or propertyId is required.", 422);
  } catch (error) {
    return handleApiError(error);
  }
}
