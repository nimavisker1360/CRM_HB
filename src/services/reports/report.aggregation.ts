import type { PipelineStage } from "mongoose";
import type { AgentScope } from "@/lib/auth/agent-scope";
import { ACTIVE_CUSTOMER_STATUSES } from "@/services/matching/matching.config";
import { MATCH_STRONG_SCORE } from "@/services/matching/matching.config";
import { reportDateMatch, reportScopeMatch } from "@/services/reports/report.filters";
import type { ReportDateWindow } from "@/services/reports/report.types";

const QUALIFIED_OR_LATER = ["QUALIFIED", "PROPERTY_SENT", "MEETING", "NEGOTIATION", "WON"];
const PENDING_FOLLOW_UP_STATUSES = ["PENDING", "OPEN", "OVERDUE", "MISSED"];
const COMPLETED_FOLLOW_UP_STATUSES = ["COMPLETED", "DONE"];

export function customerReportPipeline(scope: AgentScope, window: ReportDateWindow): PipelineStage[] {
  const scopeMatch = reportScopeMatch(scope, "assignedAgentId");
  const dateMatch = reportDateMatch(window);
  const format = seriesDateFormat(window);

  return [
    { $match: scopeMatch },
    {
      $facet: {
        kpis: [
          { $match: dateMatch },
          {
            $group: {
              _id: null,
              totalLeads: { $sum: 1 },
              newLeads: conditionalCount({ $eq: ["$status", "NEW_LEAD"] }),
              activeCustomers: conditionalCount({ $in: ["$status", ACTIVE_CUSTOMER_STATUSES] }),
              qualifiedCustomers: conditionalCount({ $eq: ["$status", "QUALIFIED"] }),
              qualifiedOrLater: conditionalCount({ $in: ["$status", QUALIFIED_OR_LATER] }),
              propertySent: conditionalCount({ $eq: ["$status", "PROPERTY_SENT"] }),
              meetings: conditionalCount({ $eq: ["$status", "MEETING"] }),
              negotiations: conditionalCount({ $eq: ["$status", "NEGOTIATION"] }),
              won: conditionalCount({ $eq: ["$status", "WON"] }),
              lost: conditionalCount({ $eq: ["$status", "LOST"] }),
            },
          },
        ],
        statuses: [{ $match: dateMatch }, { $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        sources: [
          { $match: dateMatch },
          {
            $group: {
              _id: { $ifNull: ["$source", "Other"] },
              leads: { $sum: 1 },
              qualified: conditionalCount({ $in: ["$status", QUALIFIED_OR_LATER] }),
              won: conditionalCount({ $eq: ["$status", "WON"] }),
            },
          },
          { $sort: { leads: -1 } },
          { $limit: 12 },
        ],
        cities: groupedDemand("$interestedCity", dateMatch),
        districts: groupedDemand("$interestedDistrict", dateMatch),
        propertyTypes: groupedDemand("$propertyType", dateMatch),
        transactionTypes: groupedDemand("$transactionType", dateMatch),
        rooms: [
          { $match: dateMatch },
          { $set: { requestedRooms: { $ifNull: ["$maxRooms", "$minRooms"] } } },
          { $match: { requestedRooms: { $type: "number" } } },
          { $group: { _id: "$requestedRooms", count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 10 },
        ],
        budgets: [
          { $match: { ...dateMatch, maxBudget: { $type: "number", $gte: 0 }, currency: { $type: "string" } } },
          {
            $group: {
              _id: "$currency",
              average: { $avg: "$maxBudget" },
              medianValue: { $percentile: { input: "$maxBudget", method: "approximate", p: [0.5] } },
              minimum: { $min: "$maxBudget" },
              maximum: { $max: "$maxBudget" },
              count: { $sum: 1 },
            },
          },
          { $project: { average: 1, median: { $arrayElemAt: ["$medianValue", 0] }, minimum: 1, maximum: 1, count: 1 } },
          { $sort: { _id: 1 } },
        ],
        byAgent: [
          { $match: dateMatch },
          {
            $group: {
              _id: "$assignedAgentId",
              customers: { $sum: 1 },
              newLeads: conditionalCount({ $eq: ["$status", "NEW_LEAD"] }),
              qualified: conditionalCount({ $eq: ["$status", "QUALIFIED"] }),
              meetings: conditionalCount({ $eq: ["$status", "MEETING"] }),
              negotiations: conditionalCount({ $eq: ["$status", "NEGOTIATION"] }),
              won: conditionalCount({ $eq: ["$status", "WON"] }),
              lost: conditionalCount({ $eq: ["$status", "LOST"] }),
            },
          },
        ],
        leadSeries: [
          { $match: dateMatch },
          { $group: { _id: dateBucket("$createdAt", format), newLeads: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        outcomeSeries: [
          { $match: { updatedAt: { $gte: window.from, $lt: window.to }, status: { $in: ["MEETING", "WON"] } } },
          {
            $group: {
              _id: dateBucket("$updatedAt", format),
              meetings: conditionalCount({ $eq: ["$status", "MEETING"] }),
              won: conditionalCount({ $eq: ["$status", "WON"] }),
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ];
}

export function followUpReportPipeline(scope: AgentScope, window: ReportDateWindow, now: Date): PipelineStage[] {
  const scopeMatch = reportScopeMatch(scope, "agentId");
  const format = seriesDateFormat(window);
  const dueExpression = { $ifNull: ["$scheduledAt", "$dueAt"] };
  const dueInWindow = { $and: [{ $gte: [dueExpression, window.from] }, { $lt: [dueExpression, window.to] }] };
  const completedInWindow = { completedAt: { $gte: window.from, $lt: window.to } };
  const overdueExpression = {
    $and: [dueInWindow, { $lt: [dueExpression, now] }, { $in: ["$status", PENDING_FOLLOW_UP_STATUSES] }],
  };

  return [
    { $match: scopeMatch },
    {
      $facet: {
        due: [
          { $match: { $expr: dueInWindow } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              pending: conditionalCount({ $in: ["$status", PENDING_FOLLOW_UP_STATUSES] }),
              completedDue: conditionalCount({ $in: ["$status", COMPLETED_FOLLOW_UP_STATUSES] }),
            },
          },
        ],
        completed: [{ $match: completedInWindow }, { $count: "count" }],
        overdue: [{ $match: { $expr: overdueExpression } }, { $count: "count" }],
        byAgent: [
          {
            $match: {
              $or: [{ $expr: dueInWindow }, completedInWindow],
            },
          },
          {
            $group: {
              _id: "$agentId",
              followUps: { $sum: { $cond: [dueInWindow, 1, 0] } },
              completed: { $sum: { $cond: [{ $and: [{ $gte: ["$completedAt", window.from] }, { $lt: ["$completedAt", window.to] }] }, 1, 0] } },
              overdue: { $sum: { $cond: [overdueExpression, 1, 0] } },
            },
          },
        ],
        completedSeries: [
          { $match: completedInWindow },
          { $group: { _id: dateBucket("$completedAt", format), completedFollowUps: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        customerCoverage: [
          { $match: { $expr: { $and: [dueInWindow, { $gte: [dueExpression, now] }, { $in: ["$status", PENDING_FOLLOW_UP_STATUSES] }] } } },
          { $group: { _id: { $ifNull: ["$customerId", "$customer"] } } },
          { $count: "count" },
        ],
      },
    },
  ];
}

export function matchReportPipeline(scope: AgentScope, window: ReportDateWindow): PipelineStage[] {
  const scopeMatch = reportScopeMatch(scope, "agentId");
  const dateMatch = reportDateMatch(window);

  return [
    { $match: { ...scopeMatch, ...dateMatch } },
    {
      $facet: {
        metrics: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              new: conditionalCount({ $eq: ["$status", "NEW"] }),
              sent: conditionalCount({ $eq: ["$status", "SENT"] }),
              interested: conditionalCount({ $eq: ["$status", "INTERESTED"] }),
              rejected: conditionalCount({ $eq: ["$status", "REJECTED"] }),
              meeting: conditionalCount({ $eq: ["$status", "MEETING"] }),
              strong: conditionalCount({ $gte: ["$score", MATCH_STRONG_SCORE] }),
              averageScore: { $avg: "$score" },
            },
          },
        ],
        byAgent: [
          {
            $group: {
              _id: "$agentId",
              matches: { $sum: 1 },
              interested: conditionalCount({ $eq: ["$status", "INTERESTED"] }),
            },
          },
        ],
        byProperty: propertyPerformanceFacet({ matches: -1, interested: -1, averageScore: -1 }),
        byPropertyScore: propertyPerformanceFacet({ averageScore: -1, matches: -1 }),
      },
    },
  ];
}

export function propertiesWithoutMatchPipeline(scope: AgentScope, window: ReportDateWindow): PipelineStage[] {
  const matchConditions: Record<string, unknown>[] = [
    { $eq: ["$propertyId", "$$propertyId"] },
    { $gte: ["$createdAt", window.from] },
    { $lt: ["$createdAt", window.to] },
  ];
  if (scope.effectiveAgentId) matchConditions.push({ $eq: ["$agentId", reportScopeMatch(scope, "agentId").agentId] });

  return [
    { $match: { status: "ACTIVE" } },
    {
      $lookup: {
        from: "propertymatches",
        let: { propertyId: "$_id" },
        pipeline: [{ $match: { $expr: { $and: matchConditions } } }, { $limit: 1 }, { $project: { _id: 1 } }],
        as: "matchesInPeriod",
      },
    },
    { $match: { matchesInPeriod: { $size: 0 } } },
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
    { $project: { title: 1, propertyCode: 1, city: 1, district: 1 } },
  ];
}

export function projectReportPipeline(scope: AgentScope, window: ReportDateWindow): PipelineStage[] {
  const matchConditions: Record<string, unknown>[] = [
    { $in: ["$propertyId", "$$propertyIds"] },
    { $gte: ["$createdAt", window.from] },
    { $lt: ["$createdAt", window.to] },
  ];
  if (scope.effectiveAgentId) matchConditions.push({ $eq: ["$agentId", reportScopeMatch(scope, "agentId").agentId] });

  return [
    { $match: { status: { $ne: "ARCHIVED" } } },
    { $lookup: { from: "properties", localField: "_id", foreignField: "projectId", as: "units" } },
    { $set: { propertyIds: "$units._id" } },
    {
      $lookup: {
        from: "propertymatches",
        let: { propertyIds: "$propertyIds" },
        pipeline: [{ $match: { $expr: { $and: matchConditions } } }],
        as: "periodMatches",
      },
    },
    {
      $project: {
        name: 1,
        totalUnits: { $size: "$units" },
        activeUnits: { $size: { $filter: { input: "$units", as: "unit", cond: { $eq: ["$$unit.status", "ACTIVE"] } } } },
        matches: { $size: "$periodMatches" },
        interestedCustomers: {
          $size: {
            $setUnion: [
              { $map: { input: { $filter: { input: "$periodMatches", as: "match", cond: { $eq: ["$$match.status", "INTERESTED"] } } }, as: "match", in: "$$match.customerId" } },
              [],
            ],
          },
        },
        meetings: { $size: { $filter: { input: "$periodMatches", as: "match", cond: { $eq: ["$$match.status", "MEETING"] } } } },
        customerIds: { $setUnion: ["$periodMatches.customerId", []] },
      },
    },
    { $lookup: { from: "customers", localField: "customerIds", foreignField: "_id", as: "matchedCustomers" } },
    { $set: { wonDeals: { $size: { $filter: { input: "$matchedCustomers", as: "customer", cond: { $eq: ["$$customer.status", "WON"] } } } } } },
    { $sort: { matches: -1, interestedCustomers: -1, meetings: -1 } },
    { $limit: 10 },
    { $project: { propertyIds: 0, customerIds: 0, matchedCustomers: 0 } },
  ];
}

function groupedDemand(field: string, dateMatch: Record<string, unknown>): PipelineStage.FacetPipelineStage[] {
  return [
    { $match: { ...dateMatch, [field.slice(1)]: { $nin: [null, ""] } } },
    { $group: { _id: field, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ];
}

function propertyPerformanceFacet(sort: Record<string, 1 | -1>): PipelineStage.FacetPipelineStage[] {
  return [
    {
      $group: {
        _id: "$propertyId",
        matches: { $sum: 1 },
        interested: conditionalCount({ $eq: ["$status", "INTERESTED"] }),
        sent: conditionalCount({ $eq: ["$status", "SENT"] }),
        meetings: conditionalCount({ $eq: ["$status", "MEETING"] }),
        averageScore: { $avg: "$score" },
      },
    },
    { $sort: sort },
    { $limit: 12 },
    { $lookup: { from: "properties", localField: "_id", foreignField: "_id", as: "property" } },
    { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
    { $project: { matches: 1, interested: 1, sent: 1, meetings: 1, averageScore: 1, title: "$property.title", code: "$property.propertyCode" } },
  ];
}

function conditionalCount(condition: Record<string, unknown>) {
  return { $sum: { $cond: [condition, 1, 0] } };
}

function seriesDateFormat(window: ReportDateWindow) {
  return window.to.getTime() - window.from.getTime() > 62 * 24 * 60 * 60 * 1000 ? "weekly" : "daily";
}

function dateBucket(field: string, format: "daily" | "weekly") {
  if (format === "weekly") {
    return { $dateToString: { date: { $dateTrunc: { date: field, unit: "week", timezone: "Europe/Istanbul", startOfWeek: "monday" } }, format: "%Y-%m-%d", timezone: "Europe/Istanbul" } };
  }
  return { $dateToString: { date: field, format: "%Y-%m-%d", timezone: "Europe/Istanbul" } };
}
