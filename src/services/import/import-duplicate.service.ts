import { normalizeComparisonValue, normalizePhone } from "@/services/import/import-normalizer";
import type { ImportEntityType, ImportValidationResult } from "@/services/import/import.types";
import { Customer, Project, Property } from "@/models";

export async function detectDuplicates(
  entityType: ImportEntityType,
  validation: Awaited<ReturnType<typeof import("@/services/import/import-validator").validateImportRows>>,
): Promise<ImportValidationResult> {
  const dbKeys = await loadDatabaseKeys(entityType, validation.rows.map((row) => row.normalized));
  const seen = new Set<string>();
  let duplicateRows = 0;

  const rows = validation.rows.map((row) => {
    if (row.status === "INVALID") return row;

    const keys = duplicateKeysForRow(entityType, row.normalized);
    const duplicateKey = keys.find((key) => dbKeys.has(key) || seen.has(key));

    keys.forEach((key) => seen.add(key));

    if (!duplicateKey) return row;
    duplicateRows += 1;
    return {
      ...row,
      errors: [
        ...row.errors,
        {
          field: duplicateKey.split(":")[0],
          message: "Duplicate record detected.",
          row: row.rowNumber,
          value: duplicateKey.split(":").slice(1).join(":"),
        },
      ],
      status: "DUPLICATE" as const,
    };
  });

  const validRows = rows.filter((row) => row.status === "VALID" || row.status === "WARNING").length;
  return {
    duplicateRows,
    invalidRows: validation.invalidRows,
    matchingPending: entityType === "CUSTOMERS" || entityType === "PROPERTIES",
    previewRows: rows.slice(0, 20),
    rows,
    totalRows: validation.totalRows,
    validRows,
  };
}

async function loadDatabaseKeys(entityType: ImportEntityType, rows: Record<string, unknown>[]) {
  const keys = new Set<string>();

  if (entityType === "PROPERTIES") {
    const codes = rows.map((row) => normalizeComparisonValue(row.propertyCode)).filter(Boolean);
    if (!codes.length) return keys;
    const existing = await Property.find({ propertyCode: { $in: codes.map((code) => new RegExp(`^${escapeRegExp(code)}$`, "i")) } })
      .select("propertyCode")
      .lean();
    existing.forEach((item) => keys.add(`propertyCode:${normalizeComparisonValue(item.propertyCode)}`));
    return keys;
  }

  if (entityType === "CUSTOMERS") {
    const phones = rows.map((row) => normalizePhone(String(row.phone || ""))).filter(Boolean);
    const emails = rows.map((row) => normalizeComparisonValue(row.email)).filter(Boolean);
    const whatsapps = rows.map((row) => normalizePhone(String(row.whatsapp || ""))).filter(Boolean);
    const conditions = [
      ...(phones.length ? [{ phone: { $in: phones } }] : []),
      ...(emails.length ? [{ email: { $in: emails } }] : []),
      ...(whatsapps.length ? [{ whatsapp: { $in: whatsapps } }] : []),
    ];
    if (!conditions.length) return keys;
    const existing = await Customer.find({ $or: conditions }).select("phone email whatsapp").lean();
    existing.forEach((item) => {
      if (item.phone) keys.add(`phone:${normalizePhone(String(item.phone))}`);
      if (item.email) keys.add(`email:${normalizeComparisonValue(item.email)}`);
      if (item.whatsapp) keys.add(`whatsapp:${normalizePhone(String(item.whatsapp))}`);
    });
    return keys;
  }

  const names = rows.map((row) => normalizeComparisonValue(row.name)).filter(Boolean);
  if (!names.length) return keys;
  const existing = await Project.find({ name: { $in: names.map((name) => new RegExp(`^${escapeRegExp(name)}$`, "i")) } })
    .select("name")
    .lean();
  existing.forEach((item) => keys.add(`name:${normalizeComparisonValue(item.name)}`));
  return keys;
}

function duplicateKeysForRow(entityType: ImportEntityType, row: Record<string, unknown>) {
  if (entityType === "PROPERTIES") {
    const code = normalizeComparisonValue(row.propertyCode);
    return code ? [`propertyCode:${code}`] : [];
  }

  if (entityType === "CUSTOMERS") {
    return [
      row.phone ? `phone:${normalizePhone(String(row.phone))}` : "",
      row.email ? `email:${normalizeComparisonValue(row.email)}` : "",
      row.whatsapp ? `whatsapp:${normalizePhone(String(row.whatsapp))}` : "",
    ].filter(Boolean);
  }

  const name = normalizeComparisonValue(row.name);
  return name ? [`name:${name}`] : [];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
