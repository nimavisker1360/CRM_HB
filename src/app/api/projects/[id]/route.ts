import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { cleanObject, objectIdOrUndefined } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { projectSchema } from "@/lib/validators";
import { Project, Property } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await connectToDatabase();
    const { id } = await context.params;
    const _id = objectIdOrUndefined(id);

    if (!_id) return jsonError("PROJECT_NOT_FOUND", "Project not found.", 404);

    const project = await Project.findOne({ _id, ...(session.role === "AGENT" ? { status: "ACTIVE" } : {}) }).lean();
    if (!project) return jsonError("PROJECT_NOT_FOUND", "Project not found.", 404);

    const properties = await Property.find({
      projectId: _id,
      ...(session.role === "AGENT" ? { status: "ACTIVE" } : {}),
    })
      .sort({ createdAt: -1 })
      .select("propertyCode title city district rooms grossArea price currency status")
      .lean();

    return jsonOk({ project: serializeMongo(project), properties: serializeMongo(properties) });
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

    if (!_id) return jsonError("PROJECT_NOT_FOUND", "Project not found.", 404);

    const parsed = projectSchema.partial().parse(await request.json());
    const project = await Project.findByIdAndUpdate(_id, cleanObject(parsed), { returnDocument: "after", runValidators: true });

    if (!project) return jsonError("PROJECT_NOT_FOUND", "Project not found.", 404);

    await logActivity({
      action: "UPDATED",
      description: `${session.name} updated project ${project.name}.`,
      entityId: String(project._id),
      entityType: "PROJECT",
      session,
    });

    return jsonOk(serializeMongo(project));
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

    if (!_id) return jsonError("PROJECT_NOT_FOUND", "Project not found.", 404);

    const project = await Project.findByIdAndDelete(_id);
    if (!project) return jsonError("PROJECT_NOT_FOUND", "Project not found.", 404);

    const detachedProperties = await Property.updateMany({ projectId: _id }, { $unset: { projectId: "" } });

    await logActivity({
      action: "DELETED",
      description: `${session.name} deleted project ${project.name}.`,
      entityId: String(project._id),
      entityType: "PROJECT",
      metadata: { detachedProperties: detachedProperties.modifiedCount },
      session,
    });

    return jsonOk({ deleted: true, detachedProperties: detachedProperties.modifiedCount });
  } catch (error) {
    return handleApiError(error);
  }
}
