import { describe, expect, it } from "vitest";
import { buildFunnel, overallConversionRate, percentage, sortAgentPerformance } from "@/services/reports/report.metrics";
import type { AgentPerformance } from "@/services/reports/report.types";

describe("report metric calculations", () => {
  it("never returns Infinity when a denominator is zero", () => {
    expect(percentage(4, 0)).toBe(0);
    expect(overallConversionRate(4, 0)).toBe(0);
  });

  it("calculates funnel conversion between adjacent stages", () => {
    const funnel = buildFunnel({ NEW_LEAD: 100, CONTACTED: 80, QUALIFIED: 50, PROPERTY_SENT: 30, MEETING: 15, NEGOTIATION: 8, WON: 4 });
    expect(funnel.map((stage) => stage.count)).toEqual([100, 80, 50, 30, 15, 8, 4]);
    expect(funnel[1].conversionFromPrevious).toBe(80);
    expect(funnel[2].conversionFromPrevious).toBe(62.5);
    expect(funnel[6].conversionFromPrevious).toBe(50);
  });

  it("does not rank a one-lead agent first by conversion", () => {
    const rows = [agent("small", 1, 100), agent("representative", 10, 40)];
    expect(sortAgentPerformance(rows, "BEST_CONVERSION")[0].agentId).toBe("representative");
  });
});

function agent(agentId: string, customers: number, conversionRate: number): AgentPerformance {
  return { agentId, agentName: agentId, customers, conversionRate, newLeads: 0, qualified: 0, followUps: 0, completedFollowUps: 0, overdue: 0, matches: 0, interested: 0, meetings: 0, negotiations: 0, won: 0, lost: 0 };
}
