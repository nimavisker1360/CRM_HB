import Link from "next/link";
import { Bell, Bot, Building2, CalendarCheck, FileUp, RotateCcw, Sparkles, UserRoundCog, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AgentAvatar } from "@/components/crm/AgentAvatar";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import type { AgentScope } from "@/lib/auth/agent-scope";
import type { SessionUser } from "@/lib/auth/session";
import {
  getDashboardAgents,
  getDashboardAgentProfile,
  getDashboardStats,
  getRecentCustomers,
  getRecentProperties,
  getTodayFollowUps,
  getTopMatchesToday,
} from "@/lib/crm-data";
import { compactNumber, currency, formatGregorianTime } from "@/lib/format";
import { serializeMongo } from "@/lib/serialize";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n-server";
import { getRecentNotifications } from "@/services/notifications/notification.service";

type ScopedDashboardProps = {
  agentName?: string;
  basePath?: string;
  scope: AgentScope;
  session: SessionUser;
};

type DetailRecord = Record<string, unknown> & { _id: string };

export async function ScopedDashboard({ agentName, basePath = "/dashboard", scope, session }: ScopedDashboardProps) {
  const locale = await getServerLocale();
  const d = getDictionary(locale).dashboard;
  const isAgentScope = Boolean(scope.effectiveAgentId);
  const [stats, recentCustomers, recentProperties, topMatchesToday, todayFollowUps, agents, recentNotifications, scopedAgentProfile] = await Promise.all([
    getDashboardStats(scope),
    getRecentCustomers(5, scope),
    getRecentProperties(),
    getTopMatchesToday(5, scope),
    getTodayFollowUps(5, scope),
    session.role === "AGENT" ? Promise.resolve([]) : getDashboardAgents(),
    getRecentNotifications({ limit: 5, scope, session }),
    getDashboardAgentProfile(scope.effectiveAgentId),
  ]);

  const selectedAgentName = agentName || String(scopedAgentProfile?.fullName || scopedAgentProfile?.name || (session.role === "AGENT" ? session.name : "")) || undefined;
  const customersHref = scope.effectiveAgentId ? `/customers?assignedAgentId=${scope.effectiveAgentId}` : "/customers";
  const matchesHref = scope.effectiveAgentId ? `/matches?agentId=${scope.effectiveAgentId}` : "/matches";
  const followUpsHref = scope.effectiveAgentId ? `/follow-ups?agentId=${scope.effectiveAgentId}` : "/follow-ups";
  const notificationsHref = scope.effectiveAgentId ? `/notifications?agentId=${scope.effectiveAgentId}` : "/notifications";

  return (
    <>
      <PageHeader
        action={isAgentScope ? (
          <div className="flex flex-wrap items-center gap-3">
            <AgentAvatar className="size-20 text-lg shadow-md ring-2 ring-blue-100" name={selectedAgentName} src={scopedAgentProfile?.avatarDataUrl} />
            {scope.isAdminViewingAgent ? <div className="flex items-center gap-2">
              <Badge tone="amber">{d.adminView}</Badge>
              <Link className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700" href="/dashboard">
                <RotateCcw className="size-4" />
                {d.companyView}
              </Link>
            </div> : null}
          </div>
        ) : null}
        title={isAgentScope ? `${d.agentTitle} ${selectedAgentName || ""}` : d.companyTitle}
        description={isAgentScope ? d.agentDescription : d.companyDescription}
      />
      <div className="mx-auto max-w-[1540px] space-y-6 p-4 sm:p-7">
        {scope.isAdminViewingAgent ? (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <span className="size-2 rounded-full bg-amber-500" />
            <span><b>{d.viewingAgent}: {selectedAgentName || scope.effectiveAgentId}.</b> {d.auditNote}</span>
          </div>
        ) : null}

        {session.role !== "AGENT" ? (
          <form className="app-card flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between" action={basePath}>
            <div className="w-full max-w-xl">
              <label className="block text-xs font-extrabold text-slate-500" htmlFor="agentId">{d.chooseAgent}</label>
              <select className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white" defaultValue={scope.effectiveAgentId || ""} id="agentId" name="agentId">
                <option value="">{d.allAgents}</option>
                {serializeMongo(agents).map((agent) => (
                  <option key={agent._id} value={agent._id}>
                    {String(agent.fullName || agent.name || agent.email)}
                  </option>
                ))}
              </select>
            </div>
            <button className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700" type="submit"><UserRoundCog className="size-4" />{d.apply}</button>
          </form>
        ) : null}

        <form action="/ai" className="relative overflow-hidden rounded-[22px] border border-sky-200 bg-gradient-to-l from-sky-50 via-white to-blue-50 p-5 text-slate-900 shadow-[0_18px_45px_rgba(59,130,246,0.10)] sm:p-6">
          <div className="pointer-events-none absolute -end-10 -top-20 size-56 rounded-full bg-sky-300/30 blur-2xl" />
          {scope.effectiveAgentId ? <input type="hidden" name="agentId" value={scope.effectiveAgentId} /> : null}
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end">
            <div className="flex-1"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-100 text-blue-700"><Bot className="size-5" /></span><div><h2 className="font-extrabold text-slate-900">{d.askAi}</h2><p className="mt-0.5 text-xs font-medium text-slate-600">{isAgentScope ? d.askAiNoteAgent : d.askAiNoteCompany}</p></div></div>
              <input id="dashboard-ai-question" name="q" className="mt-4 h-12 w-full rounded-xl border border-sky-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder={isAgentScope ? d.askAiAgentPlaceholder : d.askAiCompanyPlaceholder} />
            </div>
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(37,99,235,0.2)] transition hover:-translate-y-0.5 hover:bg-blue-700" type="submit"><Sparkles className="size-4" />{d.openAssistant}</button>
          </div>
        </form>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {!isAgentScope ? <StatCard accent="emerald" icon={Building2} label={d.totalProperties} value={compactNumber(stats.properties, locale)} note={d.propertyInventory} /> : null}
          <StatCard accent="blue" icon={Building2} label={d.activeProperties} value={compactNumber(stats.activeProperties, locale)} note={d.availableInventory} />
          <StatCard accent="violet" icon={Users} label={isAgentScope ? d.myCustomers : d.customers} value={compactNumber(stats.customers, locale)} note={d.customerRecords} />
          <StatCard accent="amber" icon={Users} label={d.newLeads} value={compactNumber(stats.newLeads, locale)} note={d.newLeadNote} />
          <StatCard accent="emerald" icon={CalendarCheck} label={d.followUpsToday} value={compactNumber(stats.followUpsToday, locale)} note={d.scheduledToday} />
          <StatCard accent="amber" icon={CalendarCheck} label={d.overdueFollowUps} value={compactNumber(stats.overdueFollowUps, locale)} note={d.overdueNote} />
          <StatCard accent="blue" icon={Sparkles} label={d.newMatches} value={compactNumber(stats.newMatches, locale)} note={d.newMatchNote} />
          <StatCard accent="violet" icon={Sparkles} label={d.interestedMatches} value={compactNumber(stats.interestedMatches, locale)} note={d.interestedNote} />
          <StatCard accent="emerald" icon={Sparkles} label={d.meetingMatches} value={compactNumber(stats.meetingMatches, locale)} note={d.meetingNote} />
          <StatCard accent="amber" icon={Users} label={d.inactiveCustomers} value={compactNumber(stats.inactiveCustomers, locale)} note={d.inactiveNote} />
          {!isAgentScope ? <StatCard accent="violet" icon={UserRoundCog} label={d.agents} value={compactNumber(stats.agents, locale)} note={d.salesTeam} /> : null}
          {!isAgentScope ? <StatCard accent="blue" icon={Bot} label={d.automationQueue} value={compactNumber(stats.pendingAutomationItems, locale)} note={d.processingQueue} /> : null}
          {!isAgentScope ? <StatCard accent="emerald" icon={FileUp} label={d.pendingImports} value={compactNumber(stats.pendingImports, locale)} note={d.pendingMatch} /> : null}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <DashboardList title={d.recentNotifications} viewAll={d.viewAll} icon={<Bell className="size-5 text-blue-600" />} empty={d.noNotifications} href={notificationsHref}>
            {serializeMongo(recentNotifications).map((notification) => (
              <div className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto]" key={String(notification._id)}>
                <div>
                  <p className="font-bold text-slate-950">{String(notification.title || d.notification)}</p>
                  <p className="text-sm text-slate-500">{String(notification.message || notification.body || "")}</p>
                </div>
                <Badge tone={String(notification.priority) === "HIGH" || String(notification.priority) === "URGENT" ? "red" : "blue"}>
                  {String(notification.category || "SYSTEM")}
                </Badge>
              </div>
            ))}
          </DashboardList>

          <DashboardList title={d.todayFollowUps} viewAll={d.viewAll} icon={<CalendarCheck className="size-5 text-blue-600" />} empty={d.noFollowUps} href={followUpsHref}>
            {serializeMongo(todayFollowUps).map((followUp) => {
              const customer = followUp.customerId as DetailRecord | undefined;
              return (
                <div className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto]" key={followUp._id}>
                  <div>
                    <p className="font-bold text-slate-950">{String(customer?.fullName || d.customer)}</p>
                    <p className="text-sm text-slate-500">{String(followUp.type || followUp.title || d.followUp)}</p>
                  </div>
                  <span className="text-sm text-slate-600">{formatGregorianTime(followUp.scheduledAt || followUp.dueAt, locale)}</span>
                </div>
              );
            })}
          </DashboardList>

          <DashboardList title={d.newMatchesList} viewAll={d.viewAll} icon={<Sparkles className="size-5 text-blue-600" />} empty={d.noMatches} href={matchesHref}>
            {serializeMatches(topMatchesToday).map((match) => (
              <div className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto]" key={match._id}>
                <div>
                  <p className="font-medium text-slate-950">{match.customerName}</p>
                  <p className="text-sm text-slate-500">{match.propertyTitle}</p>
                </div>
                <span className="text-sm font-semibold text-emerald-700">{match.score}%</span>
              </div>
            ))}
          </DashboardList>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <DashboardList title={d.latestProperties} viewAll={d.viewAll} icon={<Building2 className="size-5 text-blue-600" />} empty={d.noProperties} href="/properties">
            {recentProperties.map((property) => (
              <div key={String(property._id)} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium text-slate-950">{property.title}</p>
                  <p className="text-sm text-slate-500">{[property.propertyCode, property.city, property.district].filter(Boolean).join(" / ")}</p>
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <Badge tone="blue">{String(property.status)}</Badge>
                  <span className="text-sm font-medium text-slate-700">{currency(property.price, property.currency, locale)}</span>
                </div>
              </div>
            ))}
          </DashboardList>

          <DashboardList title={d.latestCustomers} viewAll={d.viewAll} icon={<Users className="size-5 text-blue-600" />} empty={d.noCustomers} href={customersHref}>
            {recentCustomers.map((customer) => (
              <div key={String(customer._id)} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-950">{customer.fullName}</p>
                  <p className="truncate text-sm text-slate-500">
                    <span dir="ltr">{customer.whatsapp}</span> / {currency(customer.maxBudget, customer.currency, locale)}
                  </p>
                </div>
                <Badge tone="emerald">{String(customer.status)}</Badge>
              </div>
            ))}
          </DashboardList>
        </section>
      </div>
    </>
  );
}

function DashboardList({
  children,
  empty,
  href,
  icon,
  title,
  viewAll,
}: {
  children: React.ReactNode[];
  empty: string;
  href: string;
  icon: React.ReactNode;
  title: string;
  viewAll: string;
}) {
  return (
    <section className="app-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-blue-50">{icon}</span>
          <div>
            <h2 className="font-extrabold text-slate-950">{title}</h2>
            <Link className="mt-0.5 inline-block text-xs font-semibold text-blue-700 transition hover:text-blue-900" href={href}>
              {viewAll}
            </Link>
          </div>
        </div>
        <Link aria-label={viewAll} className="grid size-9 place-items-center rounded-xl border border-slate-100 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" href={href}>
          <RotateCcw className="size-4 rotate-45" />
        </Link>
      </div>
      <div className="divide-y divide-slate-100 [&>div]:transition-colors [&>div:hover]:bg-slate-50/70">{children.length ? children : <p className="px-5 py-10 text-center text-sm text-slate-400">{empty}</p>}</div>
    </section>
  );
}

function serializeMatches(matches: Array<Record<string, unknown>>) {
  return serializeMongo(matches).map((match) => {
    const customer = match.customerId as Record<string, unknown> | undefined;
    const property = match.propertyId as Record<string, unknown> | undefined;
    return {
      _id: String(match._id),
      customerName: String(customer?.fullName || "-"),
      propertyTitle: String(property?.title || "-"),
      score: Number(match.score || 0),
    };
  });
}
