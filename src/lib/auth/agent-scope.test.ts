import { describe, expect, it } from "vitest";
import { canAccessScopedRecord, getAgentScope, PERMISSION_MATRIX, stringifyId } from "@/lib/auth/agent-scope";
import type { SessionUser } from "@/lib/auth/session";

const admin: SessionUser = {
  email: "admin@example.com",
  name: "Admin HB",
  role: "ADMIN",
  userId: "user-admin",
};

const agent: SessionUser = {
  agentId: "agent-mehmet",
  email: "mehmet@example.com",
  name: "Mehmet Kaya",
  role: "AGENT",
  userId: "user-mehmet",
};

describe("agent scope", () => {
  it("keeps admin tools, inventory management, and destructive actions admin-only", () => {
    for (const permission of [
      PERMISSION_MATRIX.accessAdminTools,
      PERMISSION_MATRIX.deleteCrmRecords,
      PERMISSION_MATRIX.manageInventory,
    ]) {
      expect(permission).toEqual({ ADMIN: true, AGENT: false, MANAGER: false });
    }
  });

  it("keeps admin company view unscoped by default", () => {
    expect(getAgentScope(admin)).toMatchObject({
      effectiveAgentId: undefined,
      isAdminViewingAgent: false,
    });
  });

  it("lets admin view an agent workspace without impersonating", () => {
    expect(getAgentScope(admin, "agent-mehmet")).toMatchObject({
      currentUserId: "user-admin",
      effectiveAgentId: "agent-mehmet",
      isAdminViewingAgent: true,
      viewingAgentId: "agent-mehmet",
    });
  });

  it("forces agents to their own scope", () => {
    expect(getAgentScope(agent)).toMatchObject({
      currentAgentId: "agent-mehmet",
      effectiveAgentId: "agent-mehmet",
      isAdminViewingAgent: false,
    });
    expect(() => getAgentScope(agent, "agent-ali")).toThrow("FORBIDDEN");
  });

  it("checks record ownership for non-admin users", () => {
    expect(canAccessScopedRecord(agent, { assignedAgentId: "agent-mehmet" })).toBe(true);
    expect(canAccessScopedRecord(agent, { assignedAgentId: "agent-ali" })).toBe(false);
    expect(canAccessScopedRecord(admin, { assignedAgentId: "agent-ali" })).toBe(true);
  });
});

describe("stringifyId", () => {
  it("serializes a populated record containing a BSON-like ObjectId", () => {
    const objectId = {
      toHexString: () => "507f1f77bcf86cd799439011",
    } as { _id?: unknown; toHexString: () => string };
    objectId._id = objectId;

    expect(stringifyId({ _id: objectId })).toBe("507f1f77bcf86cd799439011");
  });
});
