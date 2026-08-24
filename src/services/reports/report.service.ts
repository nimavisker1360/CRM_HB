import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { Agent, Customer, FollowUp, Project, Property, PropertyMatch } from "@/models";
import { INACTIVE_CUSTOMER_DAYS } from "@/services/automation/automation.config";
import { inactiveCustomerBaseFilter } from "@/services/automation/inactive-customer";
import {
  customerReportPipeline,
  followUpReportPipeline,
  matchReportPipeline,
  projectReportPipeline,
  propertiesWithoutMatchPipeline,
} from "@/services/reports/report.aggregation";
import { reportDateMatch, reportScopeMatch } from "@/services/reports/report.filters";
import { buildFunnel, demandItems, overallConversionRate, percentage, sortAgentPerformance } from "@/services/reports/report.metrics";
import type {
  AgentPerformance,
  BudgetPerformance,
  LeadSourcePerformance,
  ProjectPerformance,
  PropertyPerformance,
  PropertyWithoutMatch,
  ReportsData,
  ResolvedReportFilters,
  TimeSeriesPoint,
} from "@/services/reports/report.types";

type Row = Record<string, unknown>;
type CustomerFacet = {
  kpis: Row[];
  statuses: Row[];
  sources: Row[];
  cities: Row[];
  districts: Row[];
  propertyTypes: Row[];
  transactionTypes: Row[];
  rooms: Row[];
  budgets: Row[];
  byAgent: Row[];
  leadSeries: Row[];
  outcomeSeries: Row[];
};
type FollowUpFacet = { due: Row[]; completed: Row[]; overdue: Row[]; byAgent: Row[]; completedSeries: Row[]; customerCoverage: Row[] };
type MatchFacet = { metrics: Row[]; byAgent: Row[]; byProperty: Row[]; byPropertyScore: Row[] };

export async function getReportsData(filters: ResolvedReportFilters): Promise<ReportsData> {
  await connectToDatabase();
  const now = new Date();
  const { dateWindow: window, scope } = filters;
  const agentQuery = scope.effectiveAgentId ? { _id: reportScopeMatch(scope, "_id")._id } : { isActive: { $ne: false } };
  const inactiveCutoff = new Date(now.getTime() - INACTIVE_CUSTOMER_DAYS * 24 * 60 * 60 * 1000);

  const [customerResult, followUpResult, matchResult, noMatchProperties, projects, agents, inactiveCustomers] = await Promise.all([
    Customer.aggregate<CustomerFacet>(customerReportPipeline(scope, window)).allowDiskUse(true),
    FollowUp.aggregate<FollowUpFacet>(followUpReportPipeline(scope, window, now)).allowDiskUse(true),
    PropertyMatch.aggregate<MatchFacet>(matchReportPipeline(scope, window)).allowDiskUse(true),
    Property.aggregate<Row>(propertiesWithoutMatchPipeline(scope, window)).allowDiskUse(true),
    Project.aggregate<Row>(projectReportPipeline(scope, window)).allowDiskUse(true),
    Agent.find(agentQuery).sort({ fullName: 1, name: 1 }).select("fullName name email").lean<Row[]>(),
    Customer.countDocuments({
      ...reportScopeMatch(scope, "assignedAgentId"),
      ...reportDateMatch(window),
      ...inactiveCustomerBaseFilter(inactiveCutoff),
    }),
  ]);

  const customer = customerResult[0] || emptyCustomerFacet();
  const followUp = followUpResult[0] || emptyFollowUpFacet();
  const match = matchResult[0] || emptyMatchFacet();
  const customerKpis = first(customer.kpis);
  const followUpDue = first(followUp.due);
  const matchMetrics = first(match.metrics);
  const statusCounts = toCountMap(customer.statuses);

  const kpis = {
    totalLeads: number(customerKpis.totalLeads),
    newLeads: number(customerKpis.newLeads),
    activeCustomers: number(customerKpis.activeCustomers),
    qualifiedCustomers: number(customerKpis.qualifiedCustomers),
    propertySent: number(customerKpis.propertySent),
    meetings: number(customerKpis.meetings),
    negotiations: number(customerKpis.negotiations),
    won: number(customerKpis.won),
    lost: number(customerKpis.lost),
    followUpsCompleted: number(first(followUp.completed).count),
    overdueFollowUps: number(first(followUp.overdue).count),
    newMatches: number(matchMetrics.new),
    interestedMatches: number(matchMetrics.interested),
  };

  const followUpPerformance = {
    total: number(followUpDue.total),
    completed: number(followUpDue.completedDue),
    pending: number(followUpDue.pending),
    overdue: kpis.overdueFollowUps,
    // Completion is completed follow-ups during the period divided by follow-ups due during it.
    completionRate: percentage(number(followUpDue.completedDue), number(followUpDue.total)),
  };

  const matchPerformance = {
    total: number(matchMetrics.total),
    new: number(matchMetrics.new),
    sent: number(matchMetrics.sent),
    interested: number(matchMetrics.interested),
    rejected: number(matchMetrics.rejected),
    meeting: number(matchMetrics.meeting),
    strong: number(matchMetrics.strong),
    averageScore: round(number(matchMetrics.averageScore)),
    interestConversion: percentage(number(matchMetrics.interested), number(matchMetrics.sent)),
    meetingConversion: percentage(number(matchMetrics.meeting), number(matchMetrics.interested)),
  };

  const agentRows = buildAgentPerformance(agents, customer.byAgent, followUp.byAgent, match.byAgent);
  const agentNames = new Map(agentRows.map((row) => [row.agentId, row.agentName]));

  return {
    generatedAt: now.toISOString(),
    dateWindow: { from: window.from.toISOString(), to: window.to.toISOString(), label: window.label, range: window.range },
    effectiveAgentId: scope.effectiveAgentId || null,
    kpis,
    funnel: buildFunnel(statusCounts),
    overallConversionRate: overallConversionRate(kpis.won, number(customerKpis.qualifiedOrLater)),
    agents: sortAgentPerformance(agentRows, filters.sort),
    followUps: followUpPerformance,
    followUpByAgent: followUp.byAgent.map((row) => ({
      agentId: id(row._id),
      agentName: agentNames.get(id(row._id)) || "مشاور نامشخص",
      completed: number(row.completed),
      overdue: number(row.overdue),
    })).sort((a, b) => b.completed - a.completed),
    matches: matchPerformance,
    pipeline: customer.statuses.map((row) => ({ status: String(row._id || "UNKNOWN"), count: number(row.count) })),
    leadSources: customer.sources.map(toLeadSource),
    demand: {
      cities: demandItems(customer.cities.map(toDemandRow), kpis.totalLeads),
      districts: demandItems(customer.districts.map(toDemandRow), kpis.totalLeads),
      propertyTypes: demandItems(customer.propertyTypes.map(toDemandRow), kpis.totalLeads),
      transactionTypes: demandItems(customer.transactionTypes.map(toDemandRow), kpis.totalLeads),
      rooms: demandItems(customer.rooms.map(toDemandRow), kpis.totalLeads),
    },
    budgets: customer.budgets.map(toBudget),
    topProperties: match.byProperty.map(toProperty),
    highestScoreProperties: match.byPropertyScore.map(toProperty),
    propertiesWithoutMatch: noMatchProperties.map(toNoMatchProperty),
    topProjects: projects.map(toProject),
    discipline: {
      activeCustomers: kpis.activeCustomers,
      customersWithUpcomingFollowUp: number(first(followUp.customerCoverage).count),
      customersWithoutUpcomingFollowUp: Math.max(kpis.activeCustomers - number(first(followUp.customerCoverage).count), 0),
      inactiveCustomers,
      overdueRate: percentage(kpis.overdueFollowUps, followUpPerformance.total),
    },
    timeSeries: mergeTimeSeries(window.from, window.to, customer.leadSeries, customer.outcomeSeries, followUp.completedSeries),
  };
}

export async function getReportAgents() {
  await connectToDatabase();
  return Agent.find({ isActive: { $ne: false } }).sort({ fullName: 1, name: 1 }).select("fullName name email").lean<Row[]>();
}

function buildAgentPerformance(agents: Row[], customers: Row[], followUps: Row[], matches: Row[]): AgentPerformance[] {
  const customerMap = byId(customers);
  const followUpMap = byId(followUps);
  const matchMap = byId(matches);
  return agents.map((agent) => {
    const agentId = id(agent._id);
    const customer = customerMap.get(agentId) || {};
    const followUp = followUpMap.get(agentId) || {};
    const match = matchMap.get(agentId) || {};
    return {
      agentId,
      agentName: String(agent.fullName || agent.name || agent.email || "مشاور"),
      customers: number(customer.customers),
      newLeads: number(customer.newLeads),
      qualified: number(customer.qualified),
      followUps: number(followUp.followUps),
      completedFollowUps: number(followUp.completed),
      overdue: number(followUp.overdue),
      matches: number(match.matches),
      interested: number(match.interested),
      meetings: number(customer.meetings),
      negotiations: number(customer.negotiations),
      won: number(customer.won),
      lost: number(customer.lost),
      conversionRate: percentage(number(customer.won), number(customer.qualified)),
    };
  });
}

function mergeTimeSeries(from: Date, to: Date, leads: Row[], outcomes: Row[], completed: Row[]): TimeSeriesPoint[] {
  const weekly = to.getTime() - from.getTime() > 62 * 24 * 60 * 60 * 1000;
  const merged = new Map<string, TimeSeriesPoint>();
  const ensure = (key: string) => {
    if (!merged.has(key)) merged.set(key, { date: key, label: key, newLeads: 0, meetings: 0, won: 0, completedFollowUps: 0 });
    return merged.get(key)!;
  };
  for (const row of leads) ensure(String(row._id)).newLeads = number(row.newLeads);
  for (const row of outcomes) {
    ensure(String(row._id)).meetings = number(row.meetings);
    ensure(String(row._id)).won = number(row.won);
  }
  for (const row of completed) ensure(String(row._id)).completedFollowUps = number(row.completedFollowUps);

  if (!merged.size) return [];
  if (!weekly) {
    for (let time = from.getTime(); time < to.getTime(); time += 24 * 60 * 60 * 1000) {
      const key = new Date(time + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
      ensure(key);
    }
  }
  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function toLeadSource(row: Row): LeadSourcePerformance {
  return {
    source: String(row._id || "Other"),
    leads: number(row.leads),
    qualified: number(row.qualified),
    won: number(row.won),
    conversionRate: percentage(number(row.won), number(row.leads)),
  };
}

function toBudget(row: Row): BudgetPerformance {
  return { currency: String(row._id), average: round(number(row.average)), median: round(number(row.median)), minimum: number(row.minimum), maximum: number(row.maximum), count: number(row.count) };
}

function toProperty(row: Row): PropertyPerformance {
  return { propertyId: id(row._id), title: String(row.title || "ملک حذف‌شده"), code: String(row.code || "-"), matches: number(row.matches), interested: number(row.interested), sent: number(row.sent), meetings: number(row.meetings), averageScore: round(number(row.averageScore)) };
}

function toNoMatchProperty(row: Row): PropertyWithoutMatch {
  return { propertyId: id(row._id), title: String(row.title || "ملک"), code: String(row.propertyCode || "-"), city: String(row.city || "-"), district: String(row.district || "-") };
}

function toProject(row: Row): ProjectPerformance {
  return { projectId: id(row._id), name: String(row.name || "پروژه"), totalUnits: number(row.totalUnits), activeUnits: number(row.activeUnits), matches: number(row.matches), interestedCustomers: number(row.interestedCustomers), meetings: number(row.meetings), wonDeals: number(row.wonDeals) };
}

function toDemandRow(row: Row) {
  return { label: row._id == null ? null : String(row._id), count: number(row.count) };
}

function toCountMap(rows: Row[]) {
  return Object.fromEntries(rows.map((row) => [String(row._id), number(row.count)]));
}

function byId(rows: Row[]) {
  return new Map(rows.map((row) => [id(row._id), row]));
}

function first(rows: Row[] | undefined): Row {
  return rows?.[0] || {};
}

function id(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && "toString" in value && typeof value.toString === "function") return value.toString();
  return String(value);
}

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function emptyCustomerFacet(): CustomerFacet {
  return { kpis: [], statuses: [], sources: [], cities: [], districts: [], propertyTypes: [], transactionTypes: [], rooms: [], budgets: [], byAgent: [], leadSeries: [], outcomeSeries: [] };
}

function emptyFollowUpFacet(): FollowUpFacet {
  return { due: [], completed: [], overdue: [], byAgent: [], completedSeries: [], customerCoverage: [] };
}

function emptyMatchFacet(): MatchFacet {
  return { metrics: [], byAgent: [], byProperty: [], byPropertyScore: [] };
}
