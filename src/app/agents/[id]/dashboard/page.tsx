import { notFound, redirect } from "next/navigation";
import { ScopedDashboard } from "@/components/dashboard/ScopedDashboard";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getAgentScope, requireAgentWorkspaceAccess } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { Agent } from "@/models";

export const dynamic = "force-dynamic";

export default async function AgentDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const _id = objectIdOrUndefined(id);
  if (!_id) notFound();

  if (!canOpenWorkspace(session, id)) {
    return (
      <DashboardShell>
        <AccessDenied message="شما به پنل مشاور دیگر دسترسی ندارید." />
      </DashboardShell>
    );
  }

  await connectToDatabase();
  const agent = await Agent.findById(_id).select("fullName name email").lean();
  if (!agent) notFound();

  const scope = getAgentScope(session, id);

  return (
    <DashboardShell>
      <ScopedDashboard agentName={String(agent.fullName || agent.name || agent.email)} basePath={`/agents/${id}/dashboard`} scope={scope} session={session} />
    </DashboardShell>
  );
}

function canOpenWorkspace(session: Awaited<ReturnType<typeof requireSession>>, agentId: string) {
  try {
    requireAgentWorkspaceAccess(session, agentId);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return false;
    throw error;
  }
}
