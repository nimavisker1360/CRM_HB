import * as XLSX from "xlsx";
import { MAX_IMPORT_FILE_SIZE } from "@/services/import/import.config";
import type { ParsedImportFile, ParsedImportRow } from "@/services/import/import.types";

const CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"]);
const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

type ParseInput = {
  buffer: Buffer;
  fileName: string;
  fileSize: number;
  fileType?: string;
  sheetName?: string;
};

export function assertImportFile(input: ParseInput) {
  const extension = extensionOf(input.fileName);
  const mime = input.fileType || "";

  if (input.fileSize > MAX_IMPORT_FILE_SIZE) {
    throw new Error("IMPORT_FILE_TOO_LARGE");
  }

  if (extension === "csv" && (mime === "" || CSV_MIME_TYPES.has(mime) || mime.includes("csv"))) return;
  if ((extension === "xlsx" || extension === "xls") && (mime === "" || XLSX_MIME_TYPES.has(mime) || mime.includes("spreadsheet"))) return;

  throw new Error("INVALID_IMPORT_FILE");
}

export function parseImportFile(input: ParseInput): ParsedImportFile {
  assertImportFile(input);
  const extension = extensionOf(input.fileName);

  if (extension === "csv") {
    return parseCsv(input.buffer);
  }

  if (extension === "xlsx" || extension === "xls") {
    return parseWorkbook(input.buffer, input.sheetName);
  }

  throw new Error("INVALID_IMPORT_FILE");
}

function parseWorkbook(buffer: Buffer, requestedSheet?: string): ParsedImportFile {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { cellDates: true, type: "buffer" });
  } catch {
    throw new Error("INVALID_IMPORT_FILE");
  }

  const sheets = workbook.SheetNames;
  if (!sheets.length) throw new Error("EMPTY_IMPORT_FILE");

  const sheetName = requestedSheet && sheets.includes(requestedSheet) ? requestedSheet : sheets[0];
  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date | null>>(worksheet, {
    blankrows: false,
    defval: "",
    header: 1,
    raw: false,
  });

  return rowsFromMatrix(matrix, sheets, sheetName);
}

function parseCsv(buffer: Buffer): ParsedImportFile {
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = detectDelimiter(text);
  const matrix = parseCsvRows(text, delimiter);
  return rowsFromMatrix(matrix, ["CSV"], "CSV");
}

function rowsFromMatrix(matrix: Array<Array<unknown>>, sheets: string[], sheetName: string): ParsedImportFile {
  const firstNonEmptyIndex = matrix.findIndex((row) => row.some((cell) => stringValue(cell) !== ""));
  if (firstNonEmptyIndex === -1) throw new Error("EMPTY_IMPORT_FILE");

  const headers = matrix[firstNonEmptyIndex].map((cell) => stringValue(cell));
  const duplicateHeaders = findDuplicateHeaders(headers);
  const rows: ParsedImportRow[] = matrix
    .slice(firstNonEmptyIndex + 1)
    .map((row, index) => {
      const values: Record<string, string> = {};
      headers.forEach((header, cellIndex) => {
        if (!header) return;
        values[header] = stringValue(row[cellIndex]);
      });
      return { rowNumber: firstNonEmptyIndex + index + 2, values };
    })
    .filter((row) => Object.values(row.values).some((value) => value !== ""));

  if (!headers.filter(Boolean).length || !rows.length) throw new Error("EMPTY_IMPORT_FILE");

  return { duplicateHeaders, headers, rows, sheetName, sheets };
}

function parseCsvRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const commaCount = countDelimiter(sample, ",");
  const semicolonCount = countDelimiter(sample, ";");
  return semicolonCount > commaCount ? ";" : ",";
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") inQuotes = !inQuotes;
    if (!inQuotes && char === delimiter) count += 1;
  }
  return count;
}

function findDuplicateHeaders(headers: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const header of headers) {
    const key = header.trim().toLocaleLowerCase("tr-TR");
    if (!key) continue;
    if (seen.has(key)) duplicates.add(header);
    seen.add(key);
  }
  return [...duplicates];
}

function stringValue(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.toLocaleLowerCase("en-US") || "";
}
