import { Activity } from "@/models";
import type { SessionUser } from "@/lib/auth/session";
import type { AgentScope } from "@/lib/auth/agent-scope";

type ActivityInput = {
  action: string;
  description: string;
  entityId: string;
  entityType: "AGENT" | "AUTOMATION_JOB" | "CUSTOMER" | "FOLLOW_UP" | "IMPORT_JOB" | "MATCH" | "PROJECT" | "PROPERTY" | "USER";
  metadata?: Record<string, unknown>;
  scope?: AgentScope;
  session?: SessionUser;
};

export async function logActivity({
  action,
  description,
  entityId,
  entityType,
  metadata,
  scope,
  session,
}: ActivityInput) {
  await Activity.create({
    action,
    actor: session?.userId,
    actorId: session?.userId,
    description,
    entityId,
    entityType,
    metadata: {
      ...metadata,
      ...(scope?.viewingAgentId ? { viewingAgentId: scope.viewingAgentId } : {}),
      ...(scope?.effectiveAgentId ? { effectiveAgentId: scope.effectiveAgentId } : {}),
    },
  });
}
