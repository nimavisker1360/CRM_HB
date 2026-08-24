import { jsonError } from "@/lib/api";
import type { ImportEntityType, ImportMapping } from "@/services/import/import.types";

const IMPORT_ENTITIES = new Set(["CUSTOMERS", "PROPERTIES", "PROJECTS"]);

export async function readImportRequestForm(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const entityType = String(formData.get("entityType") || "");
  const sheetName = String(formData.get("sheetName") || "") || undefined;
  const rawMapping = String(formData.get("mapping") || "{}");

  if (!(file instanceof File)) {
    throw new Error("IMPORT_FILE_REQUIRED");
  }

  if (!IMPORT_ENTITIES.has(entityType)) {
    throw new Error("INVALID_IMPORT_ENTITY");
  }

  let mapping: ImportMapping = {};
  try {
    mapping = JSON.parse(rawMapping) as ImportMapping;
  } catch {
    throw new Error("INVALID_IMPORT_MAPPING");
  }

  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    entityType: entityType as ImportEntityType,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    mapping,
    sheetName,
  };
}

export function importErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return undefined;

  const messages: Record<string, [string, string, number]> = {
    EMPTY_IMPORT_FILE: ["EMPTY_IMPORT_FILE", "هیچ رکوردی برای وارد کردن پیدا نشد.", 422],
    IMPORT_FILE_REQUIRED: ["IMPORT_FILE_REQUIRED", "فایل import الزامی است.", 400],
    IMPORT_FILE_TOO_LARGE: ["IMPORT_FILE_TOO_LARGE", "حجم فایل بیشتر از حد مجاز است.", 413],
    INVALID_IMPORT_ENTITY: ["INVALID_IMPORT_ENTITY", "نوع import معتبر نیست.", 400],
    INVALID_IMPORT_FILE: ["INVALID_IMPORT_FILE", "فایل معتبر CSV یا Excel نیست.", 422],
    INVALID_IMPORT_MAPPING: ["INVALID_IMPORT_MAPPING", "نگاشت ستون ها معتبر نیست.", 400],
  };

  const match = messages[error.message];
  if (!match) return undefined;
  return jsonError(match[0], match[1], match[2]);
}
