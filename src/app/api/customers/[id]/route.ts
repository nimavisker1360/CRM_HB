import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { assertCanAccessScopedRecord, canAccessScopedRecord } from "@/lib/auth/agent-scope";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { cleanObject, objectIdOrUndefined } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { customerSchema } from "@/lib/validators";
import { Activity, Customer, FollowUp, PropertyMatch } from "@/models";
import { recalculateCustomerMatches } from "@/services/matching/matching.service";
import {
  createCustomerAssignedNotification,
  createCustomerReassignedNotifications,
} from "@/services/notifications/notification.service";

export const dynamic = "force-dynamic";

function customerAccessQuery(id: string) {
  const _id = objectIdOrUndefined(id);
  if (!_id) return null;
  return { _id };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await connectToDatabase();
    const { id } = await context.params;
    const query = customerAccessQuery(id);

    if (!query) return jsonError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);

    const customer = await Customer.findOne(query)
      .populate("assignedAgentId", "fullName name email phone")
      .lean();

    if (!customer) return jsonError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
    if (!canAccessScopedRecord(session, customer)) return jsonError("FORBIDDEN", "You do not have access to this customer.", 403);

    const [followUps, activities] = await Promise.all([
      FollowUp.find({ customerId: customer._id, ...(session.role === "AGENT" ? { agentId: session.agentId || "__no_agent__" } : {}) }).sort({ scheduledAt: 1, dueAt: 1 }).limit(20).lean(),
      Activity.find({ entityType: "CUSTOMER", entityId: customer._id }).sort({ createdAt: -1 }).limit(30).lean(),
    ]);

    return jsonOk({
      activities: serializeMongo(activities),
      customer: serializeMongo(customer),
      followUps: serializeMongo(followUps),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await connectToDatabase();
    const { id } = await context.params;
    const query = customerAccessQuery(id);

    if (!query) return jsonError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);

    const parsed = customerSchema.partial().parse(await request.json());
    const existingCustomer = await Customer.findOne(query).lean();
    if (!existingCustomer) return jsonError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
    assertCanAccessScopedRecord(session, existingCustomer);

    if (session.role === "AGENT" && parsed.assignedAgentId) {
      throw new Error("FORBIDDEN");
    }
    const oldAssignedAgentId = String(existingCustomer.assignedAgentId || existingCustomer.assignedAgent || "");
    const newAssignedAgentId = parsed.assignedAgentId || oldAssignedAgentId;
    const matchingTouched = [
      "interestedCity",
      "interestedDistrict",
      "transactionType",
      "propertyType",
      "minBudget",
      "maxBudget",
      "currency",
      "minRooms",
      "maxRooms",
      "minArea",
      "maxArea",
      "citizenshipInterest",
      "investmentInterest",
      "residenceInterest",
      "status",
    ].some((key) => Object.prototype.hasOwnProperty.call(parsed, key));

    const customer = await Customer.findOneAndUpdate(
      query,
      cleanObject({
        ...parsed,
        phone: parsed.whatsapp || parsed.phone,
        assignedAgent: parsed.assignedAgentId,
        budgetMax: parsed.maxBudget,
        budgetMin: parsed.minBudget,
        lastActivityAt: parsed.lastContact || new Date(),
        matchingPending: matchingTouched ? true : undefined,
        matchingRequiredAt: matchingTouched ? new Date() : undefined,
        preferredCities: parsed.interestedCity ? [parsed.interestedCity] : undefined,
      }),
      { returnDocument: "after", runValidators: true },
    );

    if (!customer) return jsonError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);

    if (parsed.assignedAgentId && newAssignedAgentId !== oldAssignedAgentId) {
      await Promise.all([
        PropertyMatch.updateMany({ customerId: customer._id }, { $set: { agentId: parsed.assignedAgentId } }),
        FollowUp.updateMany(
          {
            status: { $in: ["PENDING", "OPEN"] },
            $and: [
              { $or: [{ customerId: customer._id }, { customer: customer._id }] },
              { $or: [{ scheduledAt: { $gte: new Date() } }, { scheduledAt: { $exists: false }, dueAt: { $gte: new Date() } }] },
            ],
          },
          { $set: { agentId: parsed.assignedAgentId, assignedAgent: parsed.assignedAgentId } },
        ),
      ]);
    }

    await logActivity({
      action: "UPDATED",
      description:
        parsed.assignedAgentId && newAssignedAgentId !== oldAssignedAgentId
          ? `${session.name} reassigned customer ${customer.fullName}.`
          : `${session.name} updated customer ${customer.fullName}.`,
      entityId: String(customer._id),
      entityType: "CUSTOMER",
      metadata:
        parsed.assignedAgentId && newAssignedAgentId !== oldAssignedAgentId
          ? { fromAgentId: oldAssignedAgentId, toAgentId: newAssignedAgentId }
          : undefined,
      session,
    });
    await recalculateCustomerMatches(customer._id);

    if (parsed.assignedAgentId && newAssignedAgentId !== oldAssignedAgentId) {
      const notificationTask = oldAssignedAgentId
        ? createCustomerReassignedNotifications({
            customerId: customer._id,
            customerName: customer.fullName,
            fromAgentId: oldAssignedAgentId,
            toAgentId: newAssignedAgentId,
          })
        : createCustomerAssignedNotification({
            agentId: newAssignedAgentId,
            customerId: customer._id,
            customerName: customer.fullName,
          });
      await notificationTask.catch((error) => console.error("[notification:customer-reassignment]", error));
    }

    return jsonOk(serializeMongo(customer));
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

    if (!_id) return jsonError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);

    const existingCustomer = await Customer.findById(_id).lean();
    if (!existingCustomer) return jsonError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
    assertCanAccessScopedRecord(session, existingCustomer);

    const customer = await Customer.findByIdAndDelete(_id);
    if (!customer) return jsonError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
    const [deletedMatches, deletedFollowUps] = await Promise.all([
      PropertyMatch.deleteMany({ customerId: _id }),
      FollowUp.deleteMany({ $or: [{ customerId: _id }, { customer: _id }] }),
    ]);

    await logActivity({
      action: "DELETED",
      description: `${session.name} deleted customer ${customer.fullName}.`,
      entityId: String(customer._id),
      entityType: "CUSTOMER",
      metadata: {
        deletedFollowUps: deletedFollowUps.deletedCount,
        deletedMatches: deletedMatches.deletedCount,
      },
      session,
    });

    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
