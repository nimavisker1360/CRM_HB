import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import { BUSINESS_TIME_ZONE, resolveDateWindow, resolveReportFilters } from "@/services/reports/report.filters";

const admin: SessionUser = { email: "admin@example.com", name: "Admin", role: "ADMIN", userId: "admin" };
const mehmet: SessionUser = { agentId: "mehmet", email: "mehmet@example.com", name: "Mehmet", role: "AGENT", userId: "user-mehmet" };

describe("report date filters", () => {
  it("uses Europe/Istanbul day boundaries for rolling ranges", () => {
    const window = resolveDateWindow({ range: "LAST_7_DAYS" }, new Date("2026-08-20T20:30:00.000Z"));
    expect(BUSINESS_TIME_ZONE).toBe("Europe/Istanbul");
    expect(window.from.toISOString()).toBe("2026-08-13T21:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-08-20T21:00:00.000Z");
  });

  it("treats the custom end date as inclusive", () => {
    const window = resolveDateWindow({ range: "CUSTOM", dateFrom: "2026-08-01", dateTo: "2026-08-03" });
    expect(window.from.toISOString()).toBe("2026-07-31T21:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-08-03T21:00:00.000Z");
  });

  it("rejects inverted, missing and excessive custom ranges", () => {
    expect(() => resolveDateWindow({ range: "CUSTOM", dateFrom: "2026-08-03", dateTo: "2026-08-01" })).toThrow("INVALID_CUSTOM_DATE_RANGE");
    expect(() => resolveDateWindow({ range: "CUSTOM", dateFrom: "2026-08-01" })).toThrow("INVALID_CUSTOM_DATE_RANGE");
    expect(() => resolveDateWindow({ range: "CUSTOM", dateFrom: "2024-01-01", dateTo: "2026-01-01" })).toThrow("INVALID_CUSTOM_DATE_RANGE");
  });
});

describe("report agent security", () => {
  it("keeps admins unscoped unless they select an agent", () => {
    expect(resolveReportFilters(admin, { range: "TODAY" }).scope.effectiveAgentId).toBeUndefined();
    expect(resolveReportFilters(admin, { agentId: "mehmet", range: "TODAY" }).scope.effectiveAgentId).toBe("mehmet");
  });

  it("rejects an agent trying to request another agent's reports", () => {
    expect(resolveReportFilters(mehmet, { range: "TODAY" }).scope.effectiveAgentId).toBe("mehmet");
    expect(() => resolveReportFilters(mehmet, { agentId: "ali", range: "TODAY" })).toThrow("FORBIDDEN");
  });
});
