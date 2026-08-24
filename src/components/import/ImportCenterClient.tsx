"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileUp,
  Loader2,
  RefreshCw,
  SearchCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MAX_IMPORT_FILE_SIZE } from "@/services/import/import.config";
import { IGNORE_FIELD } from "@/services/import/import-mapper";
import type { ImportEntityType, ImportField, ImportMapping, ImportPreviewRow } from "@/services/import/import.types";
import { formatGregorianDateTime } from "@/lib/format";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { translateLiteral, type AppLocale } from "@/lib/i18n";

type ApiResponse<T> = {
  data?: T;
  error?: { message: string };
  success: boolean;
};

type ParseResult = {
  duplicateHeaders: string[];
  fields: ImportField[];
  headers: string[];
  previewRows: Array<{ rowNumber: number; values: Record<string, string> }>;
  rowCount: number;
  sheetName?: string;
  sheets: string[];
  suggestedMapping: ImportMapping;
};

type PlanResult = {
  duplicateRows: number;
  invalidRows: number;
  matchingPending: boolean;
  previewRows: ImportPreviewRow[];
  totalRows: number;
  validRows: number;
};

type ImportJob = {
  _id: string;
  createdAt: string;
  createdBy?: { email?: string; name?: string };
  duplicateRows: number;
  entityType: ImportEntityType;
  failedRows: number;
  fileName: string;
  fileSize: number;
  importedRows: number;
  invalidRows: number;
  matchingPending: boolean;
  rowErrors?: Array<{ field?: string; message: string; row: number; value?: unknown }>;
  status: string;
  totalRows: number;
  validRows: number;
};

type JobsResult = {
  items: ImportJob[];
};

export function ImportCenterClient() {
  const { locale } = useLanguage();
  const t = importCopy(locale);
  const entityOptions: Array<{ label: string; value: ImportEntityType }> = [
    { label: t.properties, value: "PROPERTIES" }, { label: t.customers, value: "CUSTOMERS" }, { label: t.projects, value: "PROJECTS" },
  ];
  const stepLabels = t.steps;
  const [entityType, setEntityType] = useState<ImportEntityType>("CUSTOMERS");
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [sheetName, setSheetName] = useState("");
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeStep = useMemo(() => {
    if (selectedJob) return 6;
    if (plan) return 4;
    if (parseResult) return 3;
    if (file) return 1;
    return 0;
  }, [file, parseResult, plan, selectedJob]);

  useEffect(() => {
    void fetchJobs();
  }, []);

  function resetForEntity(nextEntity: ImportEntityType) {
    setEntityType(nextEntity);
    setFile(null);
    setParseResult(null);
    setMapping({});
    setPlan(null);
    setSheetName("");
    setMessage("");
    setError("");
  }

  async function fetchJobs() {
    const response = await fetch("/api/import/jobs?limit=20", { cache: "no-store" });
    const result = (await response.json()) as ApiResponse<JobsResult>;
    if (result.success && result.data) setJobs(result.data.items);
  }

  async function parseSelectedFile(nextFile = file, nextSheetName = sheetName) {
    if (!nextFile) return;
    setLoadingStep(t.readingFile);
    setError("");
    setMessage("");
    setPlan(null);

    const result = await postImportForm<ParseResult>("/api/import/parse", nextFile, nextSheetName);
    setLoadingStep("");

    if (!result.success || !result.data) {
      setError(t.fileError);
      return;
    }

    setParseResult(result.data);
    setMapping(result.data.suggestedMapping);
    setSheetName(result.data.sheetName || "");
    setMessage(`${result.data.rowCount} ${t.recordsDetected}`);
  }

  async function validateRows() {
    if (!file || !parseResult) return;
    setLoadingStep(t.validating);
    setError("");
    setMessage("");

    const result = await postImportForm<PlanResult>("/api/import/validate", file, sheetName, mapping);
    setLoadingStep("");

    if (!result.success || !result.data) {
      setError(t.validationFailed);
      return;
    }

    setPlan(result.data);
    setMessage(`${result.data.validRows} ${t.rowsReady}`);
  }

  async function executeImport() {
    if (!file || !plan) return;
    setConfirmOpen(false);
    setLoadingStep(t.importing);
    setError("");
    setMessage("");

    const result = await postImportForm<{ job: ImportJob; plan: PlanResult }>("/api/import/execute", file, sheetName, mapping);
    setLoadingStep("");

    if (!result.success || !result.data) {
      setError(t.importFailed);
      return;
    }

    setSelectedJob(result.data.job);
    setMessage(`${result.data.job.importedRows} ${t.importSuccess}`);
    await fetchJobs();
  }

  async function loadJob(jobId: string) {
    setLoadingStep(t.loadingDetails);
    const response = await fetch(`/api/import/jobs/${jobId}`, { cache: "no-store" });
    const result = (await response.json()) as ApiResponse<ImportJob>;
    setLoadingStep("");
    if (result.success && result.data) setSelectedJob(result.data);
  }

  async function postImportForm<T>(url: string, uploadFile: File, uploadSheetName = "", uploadMapping: ImportMapping = mapping) {
    const formData = new FormData();
    formData.append("entityType", entityType);
    formData.append("file", uploadFile);
    formData.append("sheetName", uploadSheetName);
    formData.append("mapping", JSON.stringify(uploadMapping));

    const response = await fetch(url, { body: formData, method: "POST" });
    return (await response.json()) as ApiResponse<T>;
  }

  const selectedEntityLabel = entityOptions.find((item) => item.value === entityType)?.label || entityType;
  const canValidate = Boolean(file && parseResult && Object.values(mapping).some((value) => value !== IGNORE_FIELD));
  const canImport = Boolean(plan && plan.validRows > 0 && file);

  return (
    <div className="space-y-5 p-6">
      <div className="grid gap-2 md:grid-cols-7">
        {stepLabels.map((label, index) => (
          <div
            className={`flex h-10 items-center justify-center rounded-md border text-xs font-medium ${
              index <= activeStep ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-500"
            }`}
            key={label}
          >
            {label}
          </div>
        ))}
      </div>

      {message ? <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loadingStep ? (
        <div className="flex items-center gap-2 rounded-md bg-sky-50 px-4 py-3 text-sm text-sky-700">
          <Loader2 className="size-4 animate-spin" />
          {loadingStep}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          {entityOptions.map((entity) => (
            <button
              className={`flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-semibold ${
                entityType === entity.value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
              key={entity.value}
              onClick={() => resetForEntity(entity.value)}
              type="button"
            >
              <Database className="size-4" />
              {entity.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="grid min-h-44 cursor-pointer place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:bg-slate-100">
          <input
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] || null;
              setFile(nextFile);
              setParseResult(null);
              setPlan(null);
              setSelectedJob(null);
              if (!nextFile) return;
              if (nextFile.size > MAX_IMPORT_FILE_SIZE) {
                setError(t.fileTooLarge);
                return;
              }
              void parseSelectedFile(nextFile, "");
            }}
            type="file"
          />
          <span className="flex flex-col items-center gap-3 text-sm text-slate-600">
            <FileUp className="size-8 text-slate-400" />
            {t.dropFile}
            <span className="text-xs text-slate-400">{t.fileFormats}</span>
          </span>
        </label>

        {file ? (
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <Meta label={t.fileName} value={file.name} />
            <Meta label={t.size} value={`${(file.size / 1024).toFixed(1)} KB`} />
            <Meta label={t.type} value={file.type || t.unknown} />
          </div>
        ) : null}
      </section>

      {parseResult ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">{t.configureFile} {selectedEntityLabel}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {parseResult.rowCount} {t.rows}, {parseResult.headers.length} {t.columns}
              </p>
            </div>
            {parseResult.sheets.length > 1 ? (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                {t.sheet}
                <select
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  onChange={(event) => {
                    const nextSheet = event.target.value;
                    setSheetName(nextSheet);
                    void parseSelectedFile(file, nextSheet);
                  }}
                  value={sheetName}
                >
                  {parseResult.sheets.map((sheet) => (
                    <option key={sheet} value={sheet}>
                      {sheet}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {parseResult.duplicateHeaders.length ? (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle className="size-4" />
              {t.duplicateColumn}: {parseResult.duplicateHeaders.join(", ")}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">{t.fileColumn}</th>
                  <th className="px-3 py-3 font-medium">{t.crmField}</th>
                  <th className="px-3 py-3 font-medium">{t.sampleValue}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parseResult.headers.map((header) => (
                  <tr key={header}>
                    <td className="px-3 py-3 font-medium text-slate-700">{header}</td>
                    <td className="px-3 py-3">
                      <select
                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                        onChange={(event) => setMapping((current) => ({ ...current, [header]: event.target.value }))}
                        value={mapping[header] || IGNORE_FIELD}
                      >
                        <option value={IGNORE_FIELD}>{t.ignore}</option>
                        {parseResult.fields.map((field) => (
                          <option key={field.key} value={field.key}>
                            {translateLiteral(field.label, locale)} ({field.key})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-3 text-slate-500">
                      {parseResult.previewRows.find((row) => row.values[header])?.values[header] || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="flex h-10 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700"
              onClick={() => {
                setMapping(parseResult.suggestedMapping);
                setPlan(null);
              }}
              type="button"
            >
              <RefreshCw className="size-4" />
              {t.autoMap}
            </button>
            <button
              className="flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-50"
              disabled={!canValidate || Boolean(loadingStep)}
              onClick={() => void validateRows()}
              type="button"
            >
              <SearchCheck className="size-4" />
              {t.validatePreview}
            </button>
          </div>
        </section>
      ) : null}

      {plan ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <Summary label={t.totalRows} value={plan.totalRows} />
            <Summary label={t.ready} value={plan.validRows} tone="emerald" />
            <Summary label={t.duplicate} value={plan.duplicateRows} tone="amber" />
            <Summary label={t.invalid} value={plan.invalidRows} tone="red" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-start text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">{t.row}</th>
                  <th className="px-3 py-3 font-medium">{t.status}</th>
                  <th className="px-3 py-3 font-medium">{t.data}</th>
                  <th className="px-3 py-3 font-medium">{t.errorsWarnings}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plan.previewRows.map((row) => (
                  <tr key={row.rowNumber} className="align-top">
                    <td className="px-3 py-3 text-slate-600">{row.rowNumber}</td>
                    <td className="px-3 py-3">
                      <StatusBadge locale={locale} status={row.status} />
                    </td>
                    <td className="max-w-[440px] px-3 py-3 text-slate-600">
                      <RecordPreview data={row.data} fields={parseResult?.fields || []} locale={locale} />
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {[...row.errors, ...row.warnings].length ? (
                        <ul className="space-y-1">
                          {[...row.errors, ...row.warnings].map((issue, index) => (
                            <li key={`${row.rowNumber}-${index}`}>
                              Row {issue.row}: {issue.field ? `${issue.field} - ` : ""}
                              {translateLiteral(issue.message, locale)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {plan.matchingPending ? (
            <div className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700">
              {t.matchingNote}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              className="flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-50"
              disabled={!canImport || Boolean(loadingStep)}
              onClick={() => setConfirmOpen(true)}
              type="button"
            >
              <CheckCircle2 className="size-4" />
              {t.importAction} {plan.validRows} {t.validRecord}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-950">{t.history}</h2>
          <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => void fetchJobs()} type="button">
            <RefreshCw className="size-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-start text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">{t.file}</th>
                <th className="px-3 py-3 font-medium">Entity</th>
                <th className="px-3 py-3 font-medium">{t.user}</th>
                <th className="px-3 py-3 font-medium">{t.total}</th>
                <th className="px-3 py-3 font-medium">{t.imported}</th>
                <th className="px-3 py-3 font-medium">{t.error}</th>
                <th className="px-3 py-3 font-medium">{t.status}</th>
                <th className="px-3 py-3 font-medium">{t.date}</th>
                <th className="px-3 py-3 font-medium">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job._id}>
                  <td className="px-3 py-3 text-slate-700">{job.fileName || "-"}</td>
                  <td className="px-3 py-3 text-slate-600">{job.entityType || "-"}</td>
                  <td className="px-3 py-3 text-slate-600">{job.createdBy?.name || job.createdBy?.email || "-"}</td>
                  <td className="px-3 py-3 text-slate-600">{job.totalRows}</td>
                  <td className="px-3 py-3 text-emerald-700">{job.importedRows}</td>
                  <td className="px-3 py-3 text-red-700">{job.failedRows + job.invalidRows}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{job.status}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-500">{formatGregorianDateTime(job.createdAt, locale)}</td>
                  <td className="px-3 py-3">
                    <button className="rounded-md border border-slate-300 px-3 py-2 text-xs" onClick={() => void loadJob(job._id)} type="button">
                      {t.details}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {confirmOpen && plan ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-950">{t.areYouSure}</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>Entity: {selectedEntityLabel}</p>
              <p>Valid rows: {plan.validRows}</p>
              <p>Duplicates skipped: {plan.duplicateRows}</p>
              <p>Invalid rows skipped: {plan.invalidRows}</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setConfirmOpen(false)} type="button">
                {t.cancel}
              </button>
              <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" onClick={() => void executeImport()} type="button">
                {t.confirmImport}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedJob ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-950">{t.importReport}</h2>
              <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setSelectedJob(null)} type="button">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-3 md:grid-cols-4">
                <Summary label={t.total} value={selectedJob.totalRows} />
                <Summary label={t.imported} value={selectedJob.importedRows} tone="emerald" />
                <Summary label={t.duplicate} value={selectedJob.duplicateRows} tone="amber" />
                <Summary label={t.invalid} value={selectedJob.invalidRows} tone="red" />
              </div>
              {selectedJob.matchingPending ? (
                <div className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700">
                  {selectedJob.importedRows} {t.importedReady}
                </div>
              ) : null}
              <a
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700"
                href={`/api/import/jobs/${selectedJob._id}/errors`}
              >
                <Download className="size-4" />
                {t.downloadErrors}
              </a>
              <div className="rounded-md border border-slate-200">
                <div className="border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">{t.errorsWarnings}</div>
                <div className="max-h-72 overflow-auto p-3 text-sm text-slate-600">
                  {selectedJob.rowErrors?.length ? (
                    <ul className="space-y-2">
                      {selectedJob.rowErrors.map((rowError, index) => (
                        <li key={index}>
                          Row {rowError.row}: {rowError.field ? `${rowError.field} - ` : ""}
                          {translateLiteral(rowError.message, locale)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    t.noErrors
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

function Summary({ label, tone = "slate", value }: { label: string; tone?: "amber" | "emerald" | "red" | "slate"; value: number }) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-50 text-slate-700",
  }[tone];

  return (
    <div className={`rounded-md px-4 py-3 ${toneClass}`}>
      <div className="text-xs">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ locale, status }: { locale: AppLocale; status: string }) {
  const className =
    status === "VALID"
      ? "bg-emerald-50 text-emerald-700"
      : status === "WARNING"
        ? "bg-sky-50 text-sky-700"
        : status === "DUPLICATE"
          ? "bg-amber-50 text-amber-700"
          : "bg-red-50 text-red-700";
  const labels = locale === "tr" ? { DUPLICATE: "Tekrar", INVALID: "Geçersiz", VALID: "Geçerli", WARNING: "Uyarı" } : { DUPLICATE: "تکراری", INVALID: "نامعتبر", VALID: "معتبر", WARNING: "هشدار" };
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${className}`}>{labels[status as keyof typeof labels] || status}</span>;
}

function RecordPreview({ data, fields, locale }: { data: Record<string, unknown>; fields: ImportField[]; locale: AppLocale }) {
  const fieldLabelByKey = new Map(fields.map((field) => [field.key, field.label]));
  const entries = Object.entries(data).filter(([, value]) => {
    if (value === undefined || value === null || value === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  if (!entries.length) return <span className="text-slate-400">-</span>;

  return (
    <div className="grid max-h-36 min-w-[360px] gap-2 overflow-auto rounded-md bg-slate-50 p-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5" key={key}>
          <div className="truncate text-[11px] text-slate-500">{translateLiteral(fieldLabelByKey.get(key) || key, locale)}</div>
          <div className="mt-0.5 truncate text-xs font-medium text-slate-800" title={formatPreviewValue(value, locale)}>
            {formatPreviewValue(value, locale)}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatPreviewValue(value: unknown, locale: AppLocale) {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? (locale === "tr" ? "Evet" : "بله") : (locale === "tr" ? "Hayır" : "خیر");
  if (typeof value === "number") return new Intl.NumberFormat("en").format(value);
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return formatGregorianDateTime(value, locale);
  return String(value);
}

function importCopy(locale: AppLocale) {
  return locale === "tr" ? {
    actions: "İşlemler", areYouSure: "Emin misiniz?", autoMap: "Otomatik eşleştir", cancel: "İptal", columns: "sütun", configureFile: "Dosyayı yapılandır:",
    confirmImport: "Aktarımı onayla", crmField: "CRM alanı", customers: "Müşteriler", data: "Veri", date: "Tarih", details: "Ayrıntılar", downloadErrors: "Hata raporunu indir",
    dropFile: "CSV veya Excel dosyasını buraya sürükleyin ya da seçin", duplicate: "Tekrar", duplicateColumn: "Tekrarlanan sütun algılandı", error: "Hata", errorsWarnings: "Hatalar / uyarılar",
    file: "Dosya", fileColumn: "Dosya sütunu", fileError: "Dosya işlenemiyor.", fileFormats: "En fazla 10 MB; CSV, XLSX ve XLS", fileName: "Dosya adı", fileTooLarge: "Dosya boyutu 10 MB sınırını aşıyor.",
    history: "Veri aktarım geçmişi", ignore: "Yoksay", importAction: "Aktar", importFailed: "Veri aktarımı başarısız oldu.", importReport: "Aktarım raporu", importSuccess: "kayıt başarıyla aktarıldı.",
    imported: "Aktarılan", importedReady: "kayıt aktarıldı ve eşleştirmeye hazır.", importing: "Veriler gruplar halinde aktarılıyor...", invalid: "Geçersiz", loadingDetails: "Aktarım ayrıntıları alınıyor...",
    matchingNote: "Veriler aktarılacak ve eşleştirmeye hazırlanacak. Toplu eşleştirme bu istekte çalıştırılmaz.", noErrors: "Kayıtlı hata yok.", projects: "Projeler", properties: "Gayrimenkuller",
    readingFile: "Dosya okunuyor...", ready: "Aktarıma hazır", recordsDetected: "kayıt algılandı.", row: "Satır", rows: "satır", rowsReady: "satır aktarıma hazır.", sampleValue: "Örnek değer",
    sheet: "Sayfa", size: "Boyut", status: "Durum", steps: ["Seçim", "Yükleme", "Sayfa", "Eşleştirme", "Doğrulama", "Aktarım", "Rapor"], total: "Toplam", totalRows: "Toplam satır",
    type: "Tür", unknown: "Bilinmiyor", user: "Kullanıcı", validRecord: "geçerli kayıt", validatePreview: "Doğrula ve önizle", validating: "Satırlar doğrulanıyor ve tekrarlar denetleniyor...", validationFailed: "Doğrulama başarısız oldu.",
  } : {
    actions: "عملیات", areYouSure: "آیا مطمئن هستید؟", autoMap: "نگاشت خودکار", cancel: "انصراف", columns: "ستون", configureFile: "تنظیم فایل",
    confirmImport: "تأیید ورود", crmField: "فیلد CRM", customers: "مشتریان", data: "داده", date: "تاریخ", details: "جزئیات", downloadErrors: "دانلود گزارش خطاها",
    dropFile: "فایل CSV یا Excel را اینجا بکشید یا انتخاب کنید", duplicate: "تکراری", duplicateColumn: "ستون تکراری شناسایی شد", error: "خطا", errorsWarnings: "خطاها / هشدارها",
    file: "فایل", fileColumn: "ستون فایل", fileError: "فایل قابل پردازش نیست.", fileFormats: "حداکثر 10MB، فرمت‌های CSV، XLSX و XLS", fileName: "نام فایل", fileTooLarge: "حجم فایل بیشتر از حد مجاز 10MB است.",
    history: "تاریخچه ورود اطلاعات", ignore: "نادیده گرفتن", importAction: "ورود", importFailed: "ورود اطلاعات ناموفق بود.", importReport: "گزارش ورود", importSuccess: "رکورد با موفقیت وارد شد.",
    imported: "وارد شده", importedReady: "رکورد وارد شد و برای تطبیق آماده است.", importing: "در حال ورود گروهی اطلاعات...", invalid: "نامعتبر", loadingDetails: "در حال دریافت جزئیات ورود...",
    matchingNote: "داده‌ها وارد می‌شوند و برای تطبیق آماده خواهند بود. محاسبه گروهی تطبیق در این درخواست اجرا نمی‌شود.", noErrors: "خطایی ثبت نشده است.", projects: "پروژه‌ها", properties: "املاک",
    readingFile: "در حال خواندن فایل...", ready: "آماده ورود", recordsDetected: "رکورد شناسایی شد.", row: "ردیف", rows: "ردیف", rowsReady: "ردیف آماده ورود است.", sampleValue: "نمونه مقدار",
    sheet: "شیت", size: "حجم", status: "وضعیت", steps: ["انتخاب", "آپلود", "شیت", "نگاشت", "اعتبارسنجی", "ورود", "گزارش"], total: "کل", totalRows: "کل ردیف‌ها",
    type: "نوع", unknown: "نامشخص", user: "کاربر", validRecord: "رکورد معتبر", validatePreview: "اعتبارسنجی و پیش‌نمایش", validating: "در حال اعتبارسنجی ردیف‌ها و بررسی تکراری‌ها...", validationFailed: "اعتبارسنجی ناموفق بود.",
  };
}
