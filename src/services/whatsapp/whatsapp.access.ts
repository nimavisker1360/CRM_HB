import { stringifyId } from "@/lib/auth/agent-scope";
import type { SessionUser } from "@/lib/auth/session";

type ScopedWhatsAppMessage = Record<string, unknown> & { agentId?: unknown };

export function canAccessWhatsAppMessage(session: SessionUser, message: ScopedWhatsAppMessage) {
  if (session.role === "ADMIN" || session.role === "MANAGER") return true;
  return Boolean(session.agentId && stringifyId(message.agentId) === session.agentId);
}

export function assertCanAccessMessage(session: SessionUser, message: ScopedWhatsAppMessage) {
  if (!canAccessWhatsAppMessage(session, message)) throw new Error("FORBIDDEN");
}
