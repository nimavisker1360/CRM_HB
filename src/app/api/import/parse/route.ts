import { handleApiError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { getImportFields } from "@/services/import/import.config";
import { importErrorResponse, readImportRequestForm } from "@/services/import/import-api";
import { suggestImportMapping } from "@/services/import/import-mapper";
import { parseImportFile } from "@/services/import/import-parser";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();

    const input = await readImportRequestForm(request);
    const parsed = parseImportFile(input);
    const suggestedMapping = suggestImportMapping(input.entityType, parsed.headers);

    return jsonOk({
      duplicateHeaders: parsed.duplicateHeaders,
      fields: getImportFields(input.entityType),
      headers: parsed.headers,
      previewRows: parsed.rows.slice(0, 10).map((row) => ({ rowNumber: row.rowNumber, values: row.values })),
      rowCount: parsed.rows.length,
      sheetName: parsed.sheetName,
      sheets: parsed.sheets,
      suggestedMapping,
    });
  } catch (error) {
    return importErrorResponse(error) || handleApiError(error);
  }
}
