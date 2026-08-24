import { getImportFields } from "@/services/import/import.config";
import type { ImportEntityType, ImportMapping } from "@/services/import/import.types";

export const IGNORE_FIELD = "__IGNORE__";

export function suggestImportMapping(entityType: ImportEntityType, headers: string[]): ImportMapping {
  const fields = getImportFields(entityType);
  const mapping: ImportMapping = {};

  for (const header of headers) {
    const normalizedHeader = normalizeColumnName(header);
    const field = fields.find((candidate) => {
      if (normalizeColumnName(candidate.key) === normalizedHeader) return true;
      return candidate.aliases.some((alias) => normalizeColumnName(alias) === normalizedHeader);
    });
    mapping[header] = field?.key || IGNORE_FIELD;
  }

  return mapping;
}

export function normalizeColumnName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ");
}
