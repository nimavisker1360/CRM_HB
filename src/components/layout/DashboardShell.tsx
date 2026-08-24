import { Suspense } from "react";
import { RealtimeBridge } from "@/components/layout/RealtimeBridge";
import { Sidebar } from "@/components/layout/Sidebar";
import { requireSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Agent } from "@/models";

type DashboardShellProps = {
  children: React.ReactNode;
};

export async function DashboardShell({ children }: DashboardShellProps) {
  const session = await requireSession();
  let agentProfile: { avatarDataUrl?: string; fullName?: string; name?: string } | null = null;

  if (session.role === "AGENT" && session.agentId) {
    await connectToDatabase();
    agentProfile = await Agent.findById(session.agentId).select("avatarDataUrl fullName name").lean();
  }

  return (
    <div className="dashboard-shell min-h-screen lg:flex">
      <RealtimeBridge />
      <Suspense fallback={<aside className="hidden h-screen w-[280px] shrink-0 bg-sky-50 lg:block" />}>
        <Sidebar
          agentAvatar={agentProfile?.avatarDataUrl}
          agentName={agentProfile?.fullName || agentProfile?.name || session.name}
          role={session.role}
        />
      </Suspense>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
