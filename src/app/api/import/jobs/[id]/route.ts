import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { ImportJob } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/import/jobs/[id]">) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();

    const { id } = await context.params;
    const job = await ImportJob.findById(id).populate("createdBy", "name email role").lean();

    if (!job) return jsonError("IMPORT_JOB_NOT_FOUND", "Import job not found.", 404);
    return jsonOk(serializeMongo(job));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/import/jobs/[id]">) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();

    const { id } = await context.params;
    const _id = objectIdOrUndefined(id);
    if (!_id) return jsonError("IMPORT_JOB_NOT_FOUND", "Import job not found.", 404);

    const job = await ImportJob.findByIdAndDelete(_id);
    if (!job) return jsonError("IMPORT_JOB_NOT_FOUND", "Import job not found.", 404);

    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
