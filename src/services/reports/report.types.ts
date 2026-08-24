import type { AgentScope } from "@/lib/auth/agent-scope";

export const REPORT_RANGE_KEYS = ["TODAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH", "CUSTOM"] as const;
export type ReportRangeKey = (typeof REPORT_RANGE_KEYS)[number];

export type ReportDateWindow = {
  from: Date;
  to: Date;
  label: string;
  range: ReportRangeKey;
};

export type ReportFilters = {
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
  range?: string;
  sort?: string;
};

export type ResolvedReportFilters = {
  dateWindow: ReportDateWindow;
  scope: AgentScope;
  sort: AgentPerformanceSort;
};

export type ReportKpis = {
  totalLeads: number;
  newLeads: number;
  activeCustomers: number;
  qualifiedCustomers: number;
  propertySent: number;
  meetings: number;
  negotiations: number;
  won: number;
  lost: number;
  followUpsCompleted: number;
  overdueFollowUps: number;
  newMatches: number;
  interestedMatches: number;
};

export type FunnelStage = {
  status: string;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
};

export type FollowUpPerformance = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
};

export type MatchPerformance = {
  total: number;
  new: number;
  sent: number;
  interested: number;
  rejected: number;
  meeting: number;
  strong: number;
  averageScore: number;
  interestConversion: number;
  meetingConversion: number;
};

export type AgentPerformance = {
  agentId: string;
  agentName: string;
  customers: number;
  newLeads: number;
  qualified: number;
  followUps: number;
  completedFollowUps: number;
  overdue: number;
  matches: number;
  interested: number;
  meetings: number;
  negotiations: number;
  won: number;
  lost: number;
  conversionRate: number;
};

export type AgentPerformanceSort =
  | "MOST_WON"
  | "BEST_CONVERSION"
  | "MOST_COMPLETED_FOLLOWUPS"
  | "MOST_NEW_LEADS"
  | "MOST_MEETINGS"
  | "MOST_OVERDUE";

export type LeadSourcePerformance = {
  source: string;
  leads: number;
  qualified: number;
  won: number;
  conversionRate: number;
};

export type DemandItem = { label: string; count: number; percentage: number };

export type BudgetPerformance = {
  currency: string;
  average: number;
  median: number;
  minimum: number;
  maximum: number;
  count: number;
};

export type PropertyPerformance = {
  propertyId: string;
  title: string;
  code: string;
  matches: number;
  interested: number;
  sent: number;
  meetings: number;
  averageScore: number;
};

export type PropertyWithoutMatch = {
  propertyId: string;
  title: string;
  code: string;
  city: string;
  district: string;
};

export type ProjectPerformance = {
  projectId: string;
  name: string;
  totalUnits: number;
  activeUnits: number;
  matches: number;
  interestedCustomers: number;
  meetings: number;
  wonDeals: number;
};

export type TimeSeriesPoint = {
  date: string;
  label: string;
  newLeads: number;
  meetings: number;
  won: number;
  completedFollowUps: number;
};

export type DisciplineMetrics = {
  activeCustomers: number;
  customersWithUpcomingFollowUp: number;
  customersWithoutUpcomingFollowUp: number;
  inactiveCustomers: number;
  overdueRate: number;
};

export type ReportsData = {
  generatedAt: string;
  dateWindow: { from: string; to: string; label: string; range: ReportRangeKey };
  effectiveAgentId: string | null;
  kpis: ReportKpis;
  funnel: FunnelStage[];
  overallConversionRate: number;
  agents: AgentPerformance[];
  followUps: FollowUpPerformance;
  followUpByAgent: Array<{ agentId: string; agentName: string; completed: number; overdue: number }>;
  matches: MatchPerformance;
  pipeline: Array<{ status: string; count: number }>;
  leadSources: LeadSourcePerformance[];
  demand: {
    cities: DemandItem[];
    districts: DemandItem[];
    propertyTypes: DemandItem[];
    transactionTypes: DemandItem[];
    rooms: DemandItem[];
  };
  budgets: BudgetPerformance[];
  topProperties: PropertyPerformance[];
  highestScoreProperties: PropertyPerformance[];
  propertiesWithoutMatch: PropertyWithoutMatch[];
  topProjects: ProjectPerformance[];
  discipline: DisciplineMetrics;
  timeSeries: TimeSeriesPoint[];
};
