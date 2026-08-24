import { Types } from "mongoose";
import { z } from "zod";
import { cleanObject } from "@/lib/crm-utils";
import { customerSchema, projectSchema, propertySchema } from "@/lib/validators";
import { Agent, Project } from "@/models";
import { IGNORE_FIELD } from "@/services/import/import-mapper";
import { normalizeComparisonValue, normalizeImportRecord } from "@/services/import/import-normalizer";
import type {
  ImportEntityType,
  ImportMapping,
  ImportPreviewRow,
  ImportRowIssue,
  ImportValidationResult,
  ParsedImportFile,
} from "@/services/import/import.types";

const schemaByEntity: Record<ImportEntityType, z.ZodTypeAny> = {
  CUSTOMERS: customerSchema,
  PROJECTS: projectSchema,
  PROPERTIES: propertySchema,
};

export async function validateImportRows(
  entityType: ImportEntityType,
  parsed: ParsedImportFile,
  mapping: ImportMapping,
): Promise<Omit<ImportValidationResult, "duplicateRows" | "matchingPending" | "previewRows" | "rows" | "validRows"> & {
  rows: Array<ImportPreviewRow & { normalized: Record<string, unknown> }>;
}> {
  const mappedRows = parsed.rows.map((row) => {
    const mapped: Record<string, string> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (!field || field === IGNORE_FIELD) continue;
      mapped[field] = row.values[header] || "";
    }
    return { mapped, rowNumber: row.rowNumber };
  });

  const agentEmails = mappedRows.map((row) => row.mapped.assignedAgentEmail).filter(Boolean);
  const projectNames = mappedRows.map((row) => row.mapped.projectName).filter(Boolean);

  const [agents, projects] = await Promise.all([
    agentEmails.length ? Agent.find({ email: { $in: agentEmails.map((email) => String(email).toLocaleLowerCase("en-US")) } }).select("_id email").lean() : [],
    projectNames.length ? Project.find({}).select("_id name").lean() : [],
  ]);

  const agentByEmail = new Map(agents.map((agent) => [String(agent.email).toLocaleLowerCase("en-US"), String(agent._id)]));
  const projectByName = new Map(projects.map((project) => [normalizeComparisonValue(project.name), String(project._id)]));

  let invalidRows = 0;
  const rows = mappedRows.map(({ mapped, rowNumber }) => {
    const { normalized, warnings } = normalizeImportRecord(mapped, rowNumber);
    const resolvedWarnings: ImportRowIssue[] = [...warnings];

    if (typeof normalized.assignedAgentEmail === "string") {
      const agentId = agentByEmail.get(normalized.assignedAgentEmail);
      if (agentId) {
        normalized.assignedAgentId = agentId;
      } else {
        resolvedWarnings.push({
          field: "assignedAgentEmail",
          message: "Agent not found, record will be imported as unassigned.",
          row: rowNumber,
          value: normalized.assignedAgentEmail,
        });
      }
      delete normalized.assignedAgentEmail;
    }

    if (typeof normalized.projectName === "string") {
      const projectId = projectByName.get(normalizeComparisonValue(normalized.projectName));
      if (projectId) {
        normalized.projectId = projectId;
      } else {
        resolvedWarnings.push({
          field: "projectName",
          message: "Project not found, property will be imported without project.",
          row: rowNumber,
          value: normalized.projectName,
        });
      }
      delete normalized.projectName;
    }

    for (const key of ["assignedAgentId", "projectId"] as const) {
      if (typeof normalized[key] === "string" && normalized[key] !== "" && !Types.ObjectId.isValid(normalized[key])) {
        resolvedWarnings.push({ field: key, message: "ObjectId is invalid and was ignored.", row: rowNumber, value: normalized[key] });
        delete normalized[key];
      }
    }

    const validation = schemaByEntity[entityType].safeParse(normalized);
    const errors = validation.success ? [] : zodIssuesToRowIssues(validation.error, rowNumber, normalized);
    if (errors.length) invalidRows += 1;

    const cleanData = validation.success ? cleanObject(validation.data as Record<string, unknown>) : cleanObject(normalized);

    return {
      data: cleanData,
      errors,
      normalized: cleanData,
      rowNumber,
      status: errors.length ? "INVALID" as const : resolvedWarnings.length ? "WARNING" as const : "VALID" as const,
      warnings: resolvedWarnings,
    };
  });

  return {
    invalidRows,
    totalRows: parsed.rows.length,
    rows,
  };
}

function zodIssuesToRowIssues(error: z.ZodError, row: number, data: Record<string, unknown>) {
  return error.issues.map((issue) => {
    const field = issue.path.join(".");
    return {
      field,
      message: issue.message,
      row,
      value: field ? data[field] : undefined,
    };
  });
}
