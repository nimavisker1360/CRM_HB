import type { SessionUser } from "@/lib/auth/session";

type ScopedRecord = {
  [key: string]: unknown;
  agentId?: unknown;
  assignedAgent?: unknown;
  assignedAgentId?: unknown;
};

export type AgentScope = {
  currentAgentId?: string;
  currentRole: SessionUser["role"];
  currentUserId: string;
  effectiveAgentId?: string;
  isAdminViewingAgent: boolean;
  requestedAgentId?: string;
  viewingAgentId?: string;
};

export const PERMISSION_MATRIX = {
  accessAdminTools: { ADMIN: true, AGENT: false, MANAGER: false },
  deleteCrmRecords: { ADMIN: true, AGENT: false, MANAGER: false },
  editOwnCustomer: { ADMIN: true, AGENT: true, MANAGER: true },
  manageInventory: { ADMIN: true, AGENT: false, MANAGER: false },
  reassignCustomer: { ADMIN: true, AGENT: false, MANAGER: true },
  viewActiveProperties: { ADMIN: true, AGENT: true, MANAGER: true },
  viewAnotherAgentCustomers: { ADMIN: true, AGENT: false, MANAGER: true },
  viewAnotherAgentDashboard: { ADMIN: true, AGENT: false, MANAGER: true },
  viewCompanyDashboard: { ADMIN: true, AGENT: false, MANAGER: true },
  viewOwnCustomers: { ADMIN: true, AGENT: true, MANAGER: true },
  viewOwnDashboard: { ADMIN: true, AGENT: true, MANAGER: true },
} as const;

export function firstParam(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value || undefined;
}

export function getAgentScope(session: SessionUser, requestedAgentId?: string | null): AgentScope {
  const normalizedRequestedAgentId = firstParam(requestedAgentId)?.trim() || undefined;
  const currentAgentId = session.agentId;

  if (session.role === "AGENT") {
    if (normalizedRequestedAgentId && normalizedRequestedAgentId !== currentAgentId) {
      throw new Error("FORBIDDEN");
    }

    return {
      currentAgentId,
      currentRole: session.role,
      currentUserId: session.userId,
      effectiveAgentId: currentAgentId,
      isAdminViewingAgent: false,
      requestedAgentId: normalizedRequestedAgentId,
    };
  }

  if (normalizedRequestedAgentId && !canManageAllRole(session)) {
    throw new Error("FORBIDDEN");
  }

  return {
    currentAgentId,
    currentRole: session.role,
    currentUserId: session.userId,
    effectiveAgentId: normalizedRequestedAgentId,
    isAdminViewingAgent: Boolean(normalizedRequestedAgentId),
    requestedAgentId: normalizedRequestedAgentId,
    viewingAgentId: normalizedRequestedAgentId,
  };
}

export function getEffectiveAgentId(scope: AgentScope) {
  return scope.effectiveAgentId;
}

export function agentScopeFilter(scope: AgentScope, field = "assignedAgentId"): Record<string, unknown> {
  if (!scope.effectiveAgentId) return {};
  return { [field]: scope.effectiveAgentId };
}

export function resolveRequestedAgentId(searchParams: URLSearchParams, keys = ["agentId", "assignedAgentId", "agent"]) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value) return value;
  }
  return undefined;
}

export function canViewAgentWorkspace(session: SessionUser, agentId?: string | null) {
  if (!agentId) return canManageAllRole(session);
  if (canManageAllRole(session)) return true;
  return session.role === "AGENT" && session.agentId === agentId;
}

export function requireAgentWorkspaceAccess(session: SessionUser, agentId?: string | null) {
  if (!canViewAgentWorkspace(session, agentId)) {
    throw new Error("FORBIDDEN");
  }
}

export function recordAgentId(record: ScopedRecord) {
  return stringifyId(record.assignedAgentId) || stringifyId(record.assignedAgent) || stringifyId(record.agentId);
}

export function canAccessScopedRecord(session: SessionUser, record: ScopedRecord) {
  if (canManageAllRole(session)) return true;
  return Boolean(session.agentId && recordAgentId(record) === session.agentId);
}

export function assertCanAccessScopedRecord(session: SessionUser, record: ScopedRecord) {
  if (!canAccessScopedRecord(session, record)) {
    throw new Error("FORBIDDEN");
  }
}

export function stringifyId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as {
      _id?: unknown;
      toHexString?: () => string;
      toString?: () => string;
    };
    if (typeof record.toHexString === "function") return record.toHexString();
    if (record._id && record._id !== value) return stringifyId(record._id);
    if (typeof record.toString === "function") return record.toString();
  }
  return String(value);
}

function canManageAllRole(session: SessionUser) {
  return session.role === "ADMIN" || session.role === "MANAGER";
}
