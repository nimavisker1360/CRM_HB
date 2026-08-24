import type { AgentPerformance, AgentPerformanceSort, DemandItem, FunnelStage } from "@/services/reports/report.types";

export const FUNNEL_STAGES = [
  { status: "NEW_LEAD", label: "سرنخ جدید" },
  { status: "CONTACTED", label: "تماس گرفته‌شده" },
  { status: "QUALIFIED", label: "واجد شرایط" },
  { status: "PROPERTY_SENT", label: "ملک ارسال‌شده" },
  { status: "MEETING", label: "جلسه" },
  { status: "NEGOTIATION", label: "مذاکره" },
  { status: "WON", label: "موفق" },
] as const;

export const MIN_LEADS_FOR_CONVERSION_RANKING = 5;

export function percentage(numerator: number, denominator: number) {
  if (!denominator || !Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

export function buildFunnel(counts: Record<string, number>): FunnelStage[] {
  return FUNNEL_STAGES.map((stage, index) => ({
    ...stage,
    count: counts[stage.status] || 0,
    conversionFromPrevious: index === 0 ? null : percentage(counts[stage.status] || 0, counts[FUNNEL_STAGES[index - 1].status] || 0),
  }));
}

/** Overall conversion is won customers divided by qualified-or-later customers in the selected cohort. */
export function overallConversionRate(won: number, qualifiedOrLater: number) {
  return percentage(won, qualifiedOrLater);
}

export function demandItems(rows: Array<{ label?: string | null; count: number }>, total: number): DemandItem[] {
  return rows
    .filter((row) => row.label)
    .map((row) => ({ label: String(row.label), count: row.count, percentage: percentage(row.count, total) }));
}

export function sortAgentPerformance(rows: AgentPerformance[], sort: AgentPerformanceSort) {
  const sorted = [...rows];
  const selectors: Record<AgentPerformanceSort, (row: AgentPerformance) => number> = {
    MOST_WON: (row) => row.won,
    BEST_CONVERSION: (row) => (row.customers >= MIN_LEADS_FOR_CONVERSION_RANKING ? row.conversionRate : -1),
    MOST_COMPLETED_FOLLOWUPS: (row) => row.completedFollowUps,
    MOST_NEW_LEADS: (row) => row.newLeads,
    MOST_MEETINGS: (row) => row.meetings,
    MOST_OVERDUE: (row) => row.overdue,
  };
  return sorted.sort((a, b) => selectors[sort](b) - selectors[sort](a) || b.customers - a.customers || a.agentName.localeCompare(b.agentName));
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
