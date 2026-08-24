import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { cleanObject, objectIdOrUndefined } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { propertySchema } from "@/lib/validators";
import { Activity, Property, PropertyMatch } from "@/models";
import { recalculatePropertyMatches } from "@/services/matching/matching.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await connectToDatabase();
    const { id } = await context.params;
    const _id = objectIdOrUndefined(id);

    if (!_id) return jsonError("PROPERTY_NOT_FOUND", "Property not found.", 404);

    const query = session.role === "AGENT" ? { _id, status: "ACTIVE" } : { _id };
    const property = await Property.findOne(query)
      .populate("projectId", "name developer city district")
      .populate("assignedAgentId", "fullName name email phone")
      .lean();

    if (!property) return jsonError("PROPERTY_NOT_FOUND", "Property not found.", 404);

    const activities = await Activity.find({ entityType: "PROPERTY", entityId: _id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return jsonOk({ property: serializeMongo(property), activities: serializeMongo(activities) });
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

    if (!_id) return jsonError("PROPERTY_NOT_FOUND", "Property not found.", 404);

    const parsed = propertySchema.partial().parse(await request.json());
    const matchingTouched = [
      "transactionType",
      "propertyType",
      "status",
      "city",
      "district",
      "neighborhood",
      "price",
      "currency",
      "rooms",
      "grossArea",
      "areaSqm",
      "citizenshipSuitable",
      "residencePermitSuitable",
    ].some((key) => Object.prototype.hasOwnProperty.call(parsed, key));
    const property = await Property.findByIdAndUpdate(
      _id,
      cleanObject({
        ...parsed,
        assignedAgent: parsed.assignedAgentId,
        areaSqm: parsed.grossArea,
        bedrooms: parsed.rooms,
        matchingPending: matchingTouched ? true : undefined,
        matchingRequiredAt: matchingTouched ? new Date() : undefined,
        type: parsed.propertyType,
      }),
      { returnDocument: "after", runValidators: true },
    );

    if (!property) return jsonError("PROPERTY_NOT_FOUND", "Property not found.", 404);

    await logActivity({
      action: "UPDATED",
      description: `${session.name} updated property ${property.title}.`,
      entityId: String(property._id),
      entityType: "PROPERTY",
      session,
    });
    await recalculatePropertyMatches(property._id);

    return jsonOk(serializeMongo(property));
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

    if (!_id) return jsonError("PROPERTY_NOT_FOUND", "Property not found.", 404);

    const existingProperty = await Property.findOne({ _id }).lean();
    if (!existingProperty) return jsonError("PROPERTY_NOT_FOUND", "Property not found.", 404);

    const property = await Property.findOneAndDelete({ _id });
    if (!property) return jsonError("PROPERTY_NOT_FOUND", "Property not found.", 404);
    const deletedMatches = await PropertyMatch.deleteMany({ propertyId: _id });

    await logActivity({
      action: "DELETED",
      description: `${session.name} deleted property ${property.title}.`,
      entityId: String(property._id),
      entityType: "PROPERTY",
      metadata: { deletedMatches: deletedMatches.deletedCount },
      session,
    });

    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
