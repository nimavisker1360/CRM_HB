import { handleApiError, jsonError } from "@/lib/api";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { csvSafe } from "@/services/import/import-normalizer";
import { ImportJob } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/import/jobs/[id]/errors">) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();

    const { id } = await context.params;
    const job = await ImportJob.findById(id).select("fileName rowErrors").lean();

    if (!job) return jsonError("IMPORT_JOB_NOT_FOUND", "Import job not found.", 404);

    const rows = [["row", "field", "error", "value"]];
    for (const error of job.rowErrors || []) {
      rows.push([String(error.row || ""), String(error.field || ""), String(error.message || ""), String(csvSafe(error.value))]);
    }

    const body = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    return new Response(body, {
      headers: {
        "Content-Disposition": `attachment; filename="${String(job.fileName || "import-errors").replace(/\.[^.]+$/, "")}-errors.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function csvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
