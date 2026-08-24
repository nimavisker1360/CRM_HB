import { ScopedDashboard } from "@/components/dashboard/ScopedDashboard";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { firstParam, getAgentScope, type AgentScope } from "@/lib/auth/agent-scope";
import { requireSession, type SessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: PageSearchParams }) {
  const session = await requireSession();
  const params = await searchParams;
  const resolved = resolveScope(session, firstParam(params.agentId || params.agent));

  if (!resolved.scope) {
    return (
      <DashboardShell>
        <AccessDenied message="مشاور نمی‌تواند با تغییر پارامتر URL محدوده داشبورد را عوض کند." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <ScopedDashboard scope={resolved.scope} session={session} />
    </DashboardShell>
  );
}

function resolveScope(session: SessionUser, requestedAgentId?: string): { scope?: AgentScope } {
  try {
    return { scope: getAgentScope(session, requestedAgentId) };
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return {};
    throw error;
  }
}
