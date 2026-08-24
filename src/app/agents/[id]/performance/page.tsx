import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";

export default async function AgentPerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  if (!objectIdOrUndefined(id)) redirect("/agents");
  redirect(`/reports?agentId=${encodeURIComponent(id)}&range=LAST_30_DAYS`);
}
