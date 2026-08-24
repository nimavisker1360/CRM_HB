export type ImportEntityType = "CUSTOMERS" | "PROPERTIES" | "PROJECTS";

export type ImportStatus = "VALID" | "INVALID" | "DUPLICATE" | "WARNING";

export type ImportMapping = Record<string, string>;

export type ImportField = {
  key: string;
  label: string;
  aliases: string[];
  required?: boolean;
  technical?: boolean;
};

export type ParsedImportRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedImportFile = {
  duplicateHeaders: string[];
  headers: string[];
  rows: ParsedImportRow[];
  sheetName?: string;
  sheets: string[];
};

export type ImportRowIssue = {
  field?: string;
  message: string;
  row: number;
  value?: unknown;
};

export type ImportPreviewRow = {
  data: Record<string, unknown>;
  errors: ImportRowIssue[];
  rowNumber: number;
  status: ImportStatus;
  warnings: ImportRowIssue[];
};

export type ImportValidationResult = {
  duplicateRows: number;
  invalidRows: number;
  matchingPending: boolean;
  previewRows: ImportPreviewRow[];
  totalRows: number;
  validRows: number;
  rows: Array<ImportPreviewRow & { normalized: Record<string, unknown> }>;
};
