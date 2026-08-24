import { handleApiError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { importErrorResponse, readImportRequestForm } from "@/services/import/import-api";
import { buildImportPlan } from "@/services/import/import-executor";
import { parseImportFile } from "@/services/import/import-parser";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();

    const input = await readImportRequestForm(request);
    const parsed = parseImportFile(input);
    const plan = await buildImportPlan({ entityType: input.entityType, mapping: input.mapping, parsed });

    return jsonOk({
      duplicateRows: plan.duplicateRows,
      invalidRows: plan.invalidRows,
      matchingPending: plan.matchingPending,
      previewRows: plan.previewRows,
      totalRows: plan.totalRows,
      validRows: plan.validRows,
    });
  } catch (error) {
    return importErrorResponse(error) || handleApiError(error);
  }
}
