import type { SessionUser } from "@/lib/auth/session";
import { agentScopeFilter as scopedAgentFilter, getAgentScope } from "@/lib/auth/agent-scope";

export function requireRole(session: SessionUser, roles: SessionUser["role"][]) {
  if (!roles.includes(session.role)) {
    throw new Error("FORBIDDEN");
  }
}

export function canManageAll(session: SessionUser) {
  return session.role === "ADMIN" || session.role === "MANAGER";
}

export function agentScopeFilter(session: SessionUser, field = "assignedAgentId") {
  return scopedAgentFilter(getAgentScope(session), field);
}
