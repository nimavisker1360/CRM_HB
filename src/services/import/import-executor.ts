import { cleanObject } from "@/lib/crm-utils";
import { logActivity } from "@/lib/activity";
import type { SessionUser } from "@/lib/auth/session";
import { IMPORT_BATCH_SIZE, MAX_STORED_ROW_ERRORS } from "@/services/import/import.config";
import { detectDuplicates } from "@/services/import/import-duplicate.service";
import { parseImportFile } from "@/services/import/import-parser";
import { validateImportRows } from "@/services/import/import-validator";
import type { ImportEntityType, ImportMapping, ImportValidationResult, ParsedImportFile } from "@/services/import/import.types";
import { Customer, ImportJob, Project, Property } from "@/models";
import { createAdminNotification } from "@/services/notifications/notification.service";

type BuildPlanInput = {
  entityType: ImportEntityType;
  mapping: ImportMapping;
  parsed: ParsedImportFile;
};

type ExecuteInput = {
  buffer: Buffer;
  entityType: ImportEntityType;
  fileName: string;
  fileSize: number;
  fileType?: string;
  mapping: ImportMapping;
  session: SessionUser;
  sheetName?: string;
};

export async function buildImportPlan({ entityType, mapping, parsed }: BuildPlanInput): Promise<ImportValidationResult> {
  const validation = await validateImportRows(entityType, parsed, mapping);
  return detectDuplicates(entityType, validation);
}

export async function executeImport(input: ExecuteInput) {
  const parsed = parseImportFile(input);
  const plan = await buildImportPlan({ entityType: input.entityType, mapping: input.mapping, parsed });
  const importableRows = plan.rows.filter((row) => row.status === "VALID" || row.status === "WARNING");

  const job = await ImportJob.create({
    completedAt: undefined,
    createdBy: input.session.userId,
    duplicateRows: plan.duplicateRows,
    entityType: input.entityType,
    failedRows: 0,
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileType: input.fileType,
    importedRows: 0,
    invalidRows: plan.invalidRows,
    kind: input.entityType,
    matchingPending: plan.matchingPending,
    matchingStatus: plan.matchingPending ? "PENDING" : "NOT_REQUIRED",
    rowErrors: collectStoredErrors(plan),
    sheetName: parsed.sheetName,
    sourceFileName: input.fileName,
    startedAt: new Date(),
    status: "IMPORTING",
    totalRows: plan.totalRows,
    validRows: plan.validRows,
  });

  let importedRows = 0;
  let failedRows = 0;

  for (let index = 0; index < importableRows.length; index += IMPORT_BATCH_SIZE) {
    const batch = importableRows.slice(index, index + IMPORT_BATCH_SIZE);
    const documents = batch.map((row) => prepareDocument(input.entityType, row.normalized, input.session, job._id));

    try {
      const result = await modelForEntity(input.entityType).insertMany(documents, { ordered: false, rawResult: true });
      importedRows += Array.isArray(result) ? result.length : Number(result.insertedCount || 0);
    } catch (error) {
      failedRows += batch.length;
      await ImportJob.updateOne(
        { _id: job._id },
        {
          $push: {
            rowErrors: {
              $each: batch.slice(0, MAX_STORED_ROW_ERRORS).map((row) => ({
                message: error instanceof Error ? error.message : "Batch import failed.",
                row: row.rowNumber,
              })),
              $slice: MAX_STORED_ROW_ERRORS,
            },
          },
        },
      );
    }
  }

  const status = failedRows > 0 ? (importedRows > 0 ? "PARTIAL" : "FAILED") : "COMPLETED";
  await ImportJob.updateOne(
    { _id: job._id },
    {
      completedAt: new Date(),
      failedRows,
      importedRows,
      skippedRows: plan.duplicateRows + plan.invalidRows,
      status,
      summary: {
        duplicateRows: plan.duplicateRows,
        invalidRows: plan.invalidRows,
        matchingPending: plan.matchingPending,
        validRows: plan.validRows,
      },
    },
  );

  await createImportNotification({
    failedRows,
    importedRows,
    jobId: job._id,
    skippedRows: plan.duplicateRows + plan.invalidRows,
    status,
  });

  await logActivity({
    action: "IMPORTED",
    description: `${input.session.name} imported ${importedRows} ${input.entityType.toLowerCase()} from ${input.fileName}.`,
    entityId: String(job._id),
    entityType: "IMPORT_JOB",
    metadata: { entityType: input.entityType, fileName: input.fileName, importedRows, totalRows: plan.totalRows },
    session: input.session,
  });

  const completedJob = await ImportJob.findById(job._id).populate("createdBy", "name email role").lean();
  return { job: completedJob, plan: { ...plan, rows: [], previewRows: plan.previewRows } };
}

async function createImportNotification(input: {
  failedRows: number;
  importedRows: number;
  jobId: unknown;
  skippedRows: number;
  status: "COMPLETED" | "FAILED" | "PARTIAL";
}) {
  if (input.status === "COMPLETED") {
    await createAdminNotification({
      actionUrl: `/import-center?jobId=${String(input.jobId)}`,
      category: "IMPORT",
      deduplicationKey: `IMPORT_COMPLETED:${String(input.jobId)}`,
      entityId: input.jobId as never,
      entityType: "IMPORT_JOB",
      importJobId: input.jobId as never,
      message: `${input.importedRows} رکورد با موفقیت وارد CRM شدند.`,
      title: "ورود اطلاعات تکمیل شد",
      type: "IMPORT_COMPLETED",
    });
    return;
  }

  await createAdminNotification({
    actionUrl: `/import-center?jobId=${String(input.jobId)}`,
    category: "IMPORT",
    deduplicationKey: input.status === "FAILED" ? `IMPORT_FAILED:${String(input.jobId)}` : `IMPORT_PARTIAL:${String(input.jobId)}`,
    entityId: input.jobId as never,
    entityType: "IMPORT_JOB",
    importJobId: input.jobId as never,
    message: `${input.importedRows} رکورد وارد شد و ${input.failedRows + input.skippedRows} رکورد وارد نشد.`,
    priority: "HIGH",
    title: input.status === "FAILED" ? "ورود اطلاعات ناموفق بود" : "ورود اطلاعات با خطا تکمیل شد",
    type: input.status === "FAILED" ? "IMPORT_FAILED" : "IMPORT_PARTIAL",
  });
}

function prepareDocument(
  entityType: ImportEntityType,
  row: Record<string, unknown>,
  session: SessionUser,
  importJobId: unknown,
) {
  if (entityType === "CUSTOMERS") {
    return cleanObject({
      ...row,
      assignedAgent: row.assignedAgentId,
      budgetMax: row.maxBudget,
      budgetMin: row.minBudget,
      createdBy: session.userId,
      importJobId,
      lastActivityAt: row.lastContact || new Date(),
      matchingPending: true,
      matchingRequiredAt: new Date(),
      preferredCities: row.interestedCity ? [row.interestedCity] : [],
      source: row.source || "Import",
    });
  }

  if (entityType === "PROPERTIES") {
    return cleanObject({
      ...row,
      areaSqm: row.grossArea,
      assignedAgent: row.assignedAgentId,
      bedrooms: row.rooms,
      createdBy: session.userId,
      importJobId,
      matchingPending: true,
      matchingRequiredAt: new Date(),
      source: row.source || "Import",
      type: row.propertyType,
    });
  }

  return cleanObject(row);
}

function modelForEntity(entityType: ImportEntityType) {
  if (entityType === "CUSTOMERS") return Customer;
  if (entityType === "PROPERTIES") return Property;
  return Project;
}

function collectStoredErrors(plan: ImportValidationResult) {
  return plan.rows
    .flatMap((row) => [...row.errors, ...row.warnings])
    .slice(0, MAX_STORED_ROW_ERRORS)
    .map((issue) => ({
      field: issue.field,
      message: issue.message,
      row: issue.row,
      value: issue.value,
    }));
}
