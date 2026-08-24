import type { AgentScope } from "@/lib/auth/agent-scope";
import { getAgentScope } from "@/lib/auth/agent-scope";
import type { SessionUser } from "@/lib/auth/session";
import { isValidObjectId, Types } from "mongoose";
import { BUSINESS_TIME_ZONE } from "@/services/automation/automation.config";
import { REPORT_RANGE_KEYS, type ReportDateWindow, type ReportFilters, type ReportRangeKey, type ResolvedReportFilters } from "@/services/reports/report.types";

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_CUSTOM_REPORT_DAYS = 366;

export function resolveReportFilters(session: SessionUser, filters: ReportFilters, now = new Date()): ResolvedReportFilters {
  return {
    dateWindow: resolveDateWindow(filters, now),
    scope: getAgentScope(session, filters.agentId),
    sort: resolveAgentSort(filters.sort),
  };
}

export function resolveDateWindow(filters: Pick<ReportFilters, "range" | "dateFrom" | "dateTo">, now = new Date()): ReportDateWindow {
  const range = normalizeRange(filters.range);
  const today = istanbulDateParts(now);
  const todayStart = istanbulStart(today.year, today.month, today.day);

  if (range === "CUSTOM") {
    if (!isDateInput(filters.dateFrom) || !isDateInput(filters.dateTo)) {
      throw new Error("INVALID_CUSTOM_DATE_RANGE");
    }
    const fromParts = parseDateInput(filters.dateFrom);
    const toParts = parseDateInput(filters.dateTo);
    const from = istanbulStart(fromParts.year, fromParts.month, fromParts.day);
    const toInclusive = istanbulStart(toParts.year, toParts.month, toParts.day);
    const to = new Date(toInclusive.getTime() + DAY_MS);
    if (from >= to || (to.getTime() - from.getTime()) / DAY_MS > MAX_CUSTOM_REPORT_DAYS) {
      throw new Error("INVALID_CUSTOM_DATE_RANGE");
    }
    return { from, to, label: `${filters.dateFrom} تا ${filters.dateTo}`, range };
  }

  if (range === "TODAY") return { from: todayStart, to: new Date(todayStart.getTime() + DAY_MS), label: "امروز", range };
  if (range === "LAST_7_DAYS") return { from: new Date(todayStart.getTime() - 6 * DAY_MS), to: new Date(todayStart.getTime() + DAY_MS), label: "۷ روز اخیر", range };
  if (range === "LAST_30_DAYS") return { from: new Date(todayStart.getTime() - 29 * DAY_MS), to: new Date(todayStart.getTime() + DAY_MS), label: "۳۰ روز اخیر", range };

  const thisMonthStart = istanbulStart(today.year, today.month, 1);
  if (range === "THIS_MONTH") {
    return { from: thisMonthStart, to: istanbulStart(today.year, today.month + 1, 1), label: "این ماه", range };
  }

  const previousMonth = today.month === 1 ? { year: today.year - 1, month: 12 } : { year: today.year, month: today.month - 1 };
  return {
    from: istanbulStart(previousMonth.year, previousMonth.month, 1),
    to: thisMonthStart,
    label: "ماه گذشته",
    range: "LAST_MONTH",
  };
}

export function reportScopeMatch(scope: AgentScope, field: string): Record<string, unknown> {
  return scope.effectiveAgentId ? { [field]: toObjectId(scope.effectiveAgentId) } : {};
}

export function reportDateMatch(window: ReportDateWindow, field = "createdAt") {
  return { [field]: { $gte: window.from, $lt: window.to } };
}

export function reportUrlRange(range: ReportRangeKey) {
  return range.toLowerCase();
}

export function normalizeRange(value?: string): ReportRangeKey {
  const normalized = String(value || "LAST_30_DAYS").trim().toUpperCase().replaceAll("-", "_");
  const aliases: Record<string, ReportRangeKey> = {
    LAST7DAYS: "LAST_7_DAYS",
    LAST30DAYS: "LAST_30_DAYS",
    LAST_7_DAYS: "LAST_7_DAYS",
    LAST_30_DAYS: "LAST_30_DAYS",
    THISMONTH: "THIS_MONTH",
    LASTMONTH: "LAST_MONTH",
  };
  const candidate = aliases[normalized] || normalized;
  return REPORT_RANGE_KEYS.includes(candidate as ReportRangeKey) ? (candidate as ReportRangeKey) : "LAST_30_DAYS";
}

function resolveAgentSort(value?: string): ResolvedReportFilters["sort"] {
  const allowed: ResolvedReportFilters["sort"][] = [
    "MOST_WON",
    "BEST_CONVERSION",
    "MOST_COMPLETED_FOLLOWUPS",
    "MOST_NEW_LEADS",
    "MOST_MEETINGS",
    "MOST_OVERDUE",
  ];
  const normalized = String(value || "MOST_WON").toUpperCase();
  return allowed.includes(normalized as ResolvedReportFilters["sort"]) ? (normalized as ResolvedReportFilters["sort"]) : "MOST_WON";
}

function istanbulDateParts(date: Date) {
  const shifted = new Date(date.getTime() + ISTANBUL_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function istanbulStart(year: number, month: number, day: number) {
  // Europe/Istanbul has remained UTC+03:00 throughout the CRM's supported date range.
  return new Date(Date.UTC(year, month - 1, day) - ISTANBUL_OFFSET_MS);
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function isDateInput(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parseDateInput(value);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

function toObjectId(value: string) {
  if (!isValidObjectId(value)) throw new Error("INVALID_AGENT_ID");
  return new Types.ObjectId(value);
}

export { BUSINESS_TIME_ZONE };
