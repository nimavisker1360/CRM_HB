import { handleApiError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { executeImport } from "@/services/import/import-executor";
import { importErrorResponse, readImportRequestForm } from "@/services/import/import-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();

    const input = await readImportRequestForm(request);
    const result = await executeImport({ ...input, session });

    return jsonOk(serializeMongo(result), { status: 201 });
  } catch (error) {
    return importErrorResponse(error) || handleApiError(error);
  }
}
