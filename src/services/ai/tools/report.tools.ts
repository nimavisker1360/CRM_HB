import "server-only";

import { z } from "zod";
import { getAgentScope } from "@/lib/auth/agent-scope";
import { entity, defineTool, result } from "@/services/ai/tools/tool.shared";
import { resolveReportFilters } from "@/services/reports/report.filters";
import { getReportsData } from "@/services/reports/report.service";

const rangeValues = ["TODAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"] as const;
const performanceSchema = z.object({
  agentId: z.string().optional(), range: z.enum(rangeValues).optional(),
  sort: z.enum(["MOST_WON", "BEST_CONVERSION", "MOST_COMPLETED_FOLLOWUPS", "MOST_NEW_LEADS", "MOST_MEETINGS", "MOST_OVERDUE"]).optional(),
}).strict();
const companySchema = z.object({ range: z.enum(rangeValues).optional(), sort: z.enum(["MOST_WON", "BEST_CONVERSION", "MOST_COMPLETED_FOLLOWUPS", "MOST_NEW_LEADS", "MOST_MEETINGS", "MOST_OVERDUE"]).optional() }).strict();

function compactReport(report: Awaited<ReturnType<typeof getReportsData>>) {
  return {
    generatedAt: report.generatedAt, dateWindow: report.dateWindow, effectiveAgentId: report.effectiveAgentId,
    kpis: report.kpis, overallConversionRate: report.overallConversionRate,
    agents: report.agents.slice(0, 20), followUps: report.followUps, matches: report.matches,
    discipline: report.discipline, demand: report.demand, topProperties: report.topProperties.slice(0, 10), topProjects: report.topProjects.slice(0, 10),
    leadSources: report.leadSources.slice(0, 10), budgets: report.budgets,
  };
}

export const getAgentPerformanceTool = defineTool({
  declaration: { name: "getAgentPerformance", description: "Get metrics from the existing Reports service. Agents can only retrieve self performance; admin company view may select an agent.", parametersJsonSchema: { type: "object", additionalProperties: false, properties: { agentId: { type: "string" }, range: { type: "string", enum: rangeValues }, sort: { type: "string", enum: ["MOST_WON", "BEST_CONVERSION", "MOST_COMPLETED_FOLLOWUPS", "MOST_NEW_LEADS", "MOST_MEETINGS", "MOST_OVERDUE"] } } } },
  async execute(rawArgs, context) {
    const args = performanceSchema.parse(rawArgs);
    let targetAgentId = context.scope.effectiveAgentId;
    if (args.agentId) {
      if (targetAgentId && targetAgentId !== args.agentId) throw new Error("FORBIDDEN");
      targetAgentId = getAgentScope(context.session, args.agentId).effectiveAgentId;
    }
    if (!targetAgentId && context.session.role === "AGENT") throw new Error("FORBIDDEN");
    const filters = resolveReportFilters(context.session, { agentId: targetAgentId, range: args.range, sort: args.sort });
    const report = await getReportsData(filters);
    const data = compactReport(report);
    return result(data, report.agents.map((agent) => entity("agent", agent.agentId, agent.agentName)));
  },
});

export const getCompanyReportTool = defineTool({
  declaration: { name: "getCompanyReport", description: "Get company-wide or current admin-workspace report metrics. Only ADMIN or MANAGER may use this tool.", parametersJsonSchema: { type: "object", additionalProperties: false, properties: { range: { type: "string", enum: rangeValues }, sort: { type: "string", enum: ["MOST_WON", "BEST_CONVERSION", "MOST_COMPLETED_FOLLOWUPS", "MOST_NEW_LEADS", "MOST_MEETINGS", "MOST_OVERDUE"] } } } },
  async execute(rawArgs, context) {
    if (context.session.role === "AGENT") throw new Error("FORBIDDEN");
    const args = companySchema.parse(rawArgs);
    const filters = resolveReportFilters(context.session, { agentId: context.scope.effectiveAgentId, range: args.range, sort: args.sort });
    const report = await getReportsData(filters);
    const data = compactReport(report);
    return result(data, report.agents.map((agent) => entity("agent", agent.agentId, agent.agentName)));
  },
});

export const reportTools = [getAgentPerformanceTool, getCompanyReportTool];
