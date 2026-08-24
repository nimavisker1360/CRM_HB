import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import { getAgentScope } from "@/lib/auth/agent-scope";
import {
  applyNotificationFilters,
  notificationScopeQuery,
} from "@/services/notifications/notification.service";
import { notificationDeduplicationKey } from "@/services/notifications/notification-deduplication";
import {
  buildFollowUpDueNotification,
  buildFollowUpOverdueNotification,
  buildNewMatchNotification,
} from "@/services/notifications/notification.templates";
import { safeNotificationActionUrl } from "@/services/notifications/notification-url";

const admin: SessionUser = {
  email: "admin@example.com",
  name: "Admin",
  role: "ADMIN",
  userId: "64f000000000000000000001",
};

const agent: SessionUser = {
  agentId: "64f000000000000000000101",
  email: "mehmet@example.com",
  name: "Mehmet",
  role: "AGENT",
  userId: "64f000000000000000000002",
};

describe("notification scope", () => {
  it("limits agents to their own notification recipients", () => {
    const scope = getAgentScope(agent);
    const query = notificationScopeQuery({ scope, session: agent });

    expect(JSON.stringify(query)).toContain(agent.agentId);
    expect(JSON.stringify(query)).toContain(agent.userId);
  });

  it("lets admins view an agent workspace without changing actor", () => {
    const scope = getAgentScope(admin, agent.agentId);
    const query = notificationScopeQuery({ scope, session: admin });

    expect(JSON.stringify(query)).toContain(agent.agentId);
    expect(scope.currentUserId).toBe(admin.userId);
  });

  it("rejects agent access to another agent notification scope", () => {
    expect(() => getAgentScope(agent, "64f000000000000000000202")).toThrow("FORBIDDEN");
  });

  it("filters unread count without loading notification rows", () => {
    const query = applyNotificationFilters(notificationScopeQuery({ scope: getAgentScope(agent), session: agent }), {
      status: "UNREAD",
    });

    expect(query.status).toBe("UNREAD");
  });
});

describe("notification deduplication and templates", () => {
  it("builds stable deduplication keys for core events", () => {
    expect(notificationDeduplicationKey.newMatch("match-1")).toBe("NEW_MATCH:match-1");
    expect(notificationDeduplicationKey.followupDue("follow-1", "2026-08-17")).toBe("FOLLOWUP_DUE:follow-1:2026-08-17");
    expect(notificationDeduplicationKey.followupOverdue("follow-1")).toBe("FOLLOWUP_OVERDUE:follow-1");
    expect(notificationDeduplicationKey.automationFailed("job-1")).toBe("AUTOMATION_FAILED:job-1");
    expect(notificationDeduplicationKey.importCompleted("import-1")).toBe("IMPORT_COMPLETED:import-1");
  });

  it("creates Persian messages with safe internal action URLs", () => {
    const match = buildNewMatchNotification({
      customerName: "Ahmet Yilmaz",
      matchId: "match-1",
      propertyTitle: "Makyol Santral 3+1",
      score: 96,
    });
    const due = buildFollowUpDueNotification({ customerName: "Ahmet Yilmaz", followUpId: "follow-1" });
    const overdue = buildFollowUpOverdueNotification({ customerName: "Ahmet Yilmaz", followUpId: "follow-1" });

    expect(match.message).toContain("Ahmet Yilmaz");
    expect(match.message).toContain("96%");
    expect(due.title).toBe("پیگیری امروز");
    expect(overdue.title).toBe("پیگیری عقب‌افتاده");
    expect(safeNotificationActionUrl(match.actionUrl)).toBe("/matches/match-1");
  });

  it("blocks external or unsupported action URLs", () => {
    expect(safeNotificationActionUrl("https://example.com")).toBeUndefined();
    expect(safeNotificationActionUrl("//example.com")).toBeUndefined();
    expect(safeNotificationActionUrl("/unknown/1")).toBeUndefined();
    expect(safeNotificationActionUrl("/customers/1")).toBe("/customers/1");
  });
});
