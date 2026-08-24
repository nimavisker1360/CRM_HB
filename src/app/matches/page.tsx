import Link from "next/link";
import {
  ArrowLeft,
  BedDouble,
  Building2,
  CircleAlert,
  MapPin,
  Ruler,
  Sparkles,
  UserRoundSearch,
  WalletCards,
} from "lucide-react";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { MatchScoreBadge } from "@/components/matches/MatchScoreBadge";
import { MatchStatusActions } from "@/components/matches/MatchStatusActions";
import { RecalculateMatchesButton } from "@/components/matches/RecalculateMatchesButton";
import {
  getMatchProjectDictionary,
  matchProjectScoreLabel,
  type MatchProjectDictionary,
} from "@/components/matches/match-project-i18n";
import { Badge } from "@/components/ui/Badge";
import { WhatsAppComposer } from "@/components/whatsapp/WhatsAppComposer";
import { agentScopeFilter, getAgentScope, type AgentScope } from "@/lib/auth/agent-scope";
import { requireSession, type SessionUser } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { currency, formatGregorianDate } from "@/lib/format";
import { translateLiteral } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n-server";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { Agent, Customer, Property, PropertyMatch } from "@/models";
import { MATCH_MIN_SCORE, MATCH_STATUSES } from "@/services/matching/matching.config";
import { buildPropertyCandidateQuery } from "@/services/matching/matching.service";

export const dynamic = "force-dynamic";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type DetailRecord = Record<string, unknown> & { _id: string };
type MatchGroup = {
  bestScore: number;
  key: string;
  matches: DetailRecord[];
  project?: DetailRecord;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MatchesPage({ searchParams }: { searchParams: PageSearchParams }) {
  const session = await requireSession();
  const locale = await getServerLocale();
  const t = getMatchProjectDictionary(locale);
  await connectToDatabase();

  const params = await searchParams;
  const resolved = resolveScope(session, firstParam(params.agentId || params.agent));
  if (!resolved.scope) {
    return (
      <DashboardShell>
        <AccessDenied message="مشاور نمی‌تواند با تغییر پارامتر URL محدوده تطبیق‌ها را عوض کند." />
      </DashboardShell>
    );
  }

  const scope = resolved.scope;
  const requestedCustomerId = firstParam(params.customerId)?.trim();
  const selectedCustomerId = objectIdOrUndefined(requestedCustomerId);
  const selectedStatus = firstParam(params.status);
  const status = MATCH_STATUSES.includes(selectedStatus as never) ? selectedStatus : undefined;
  const minimumScore = clampScore(firstParam(params.minScore));
  const customerScope = agentScopeFilter(scope);

  const [agentsResult, customersResult, selectedCustomerResult] = await Promise.all([
    session.role === "AGENT"
      ? Promise.resolve([])
      : Agent.find({}).sort({ fullName: 1, name: 1 }).select("fullName name").lean(),
    Customer.find(customerScope)
      .sort({ updatedAt: -1, fullName: 1 })
      .limit(200)
      .select("fullName whatsapp status interestedCity interestedDistrict maxBudget currency matchingPending")
      .lean(),
    selectedCustomerId
      ? Customer.findOne({ _id: selectedCustomerId, ...customerScope })
          .select(
            "fullName phone whatsapp status interestedCity interestedDistrict transactionType propertyType minBudget maxBudget currency minRooms maxRooms minArea maxArea matchingPending lastMatchedAt assignedAgentId",
          )
          .populate("assignedAgentId", "fullName name")
          .lean<DetailRecord | null>()
      : Promise.resolve(null),
  ]);

  if (requestedCustomerId && (!selectedCustomerId || !selectedCustomerResult)) {
    return (
      <DashboardShell>
        <AccessDenied message={t.customerAccessDenied} />
      </DashboardShell>
    );
  }

  const agents = serializeMongo(agentsResult);
  const customers = serializeMongo(customersResult);
  const selectedCustomer = serializeMongo(selectedCustomerResult);
  const candidateQuery = selectedCustomerResult ? buildPropertyCandidateQuery(selectedCustomerResult) : undefined;
  const [activePropertiesResult, candidatePropertyIdsResult] = candidateQuery
    ? await Promise.all([
        Property.find(candidateQuery)
          .collation({ locale: "tr", strength: 1 })
          .sort({ updatedAt: -1, title: 1 })
          .limit(250)
          .select("title propertyCode city district price currency rooms grossArea images videoUrl")
          .lean<DetailRecord[]>(),
        Property.find(candidateQuery)
          .collation({ locale: "tr", strength: 1 })
          .select("_id")
          .lean<DetailRecord[]>(),
      ])
    : [[], []];
  const activeProperties = serializeMongo(activePropertiesResult);
  const matchQuery: Record<string, unknown> | undefined = selectedCustomerId
    ? {
        ...agentScopeFilter(scope, "agentId"),
        customerId: selectedCustomerId,
        propertyId: { $in: candidatePropertyIdsResult.map((property) => property._id) },
        score: { $gte: minimumScore },
        status: status || { $ne: "ARCHIVED" },
      }
    : undefined;

  const items = matchQuery
    ? serializeMongo(
        await PropertyMatch.find(matchQuery)
          .sort({ score: -1, updatedAt: -1 })
          .limit(100)
          .populate({
            path: "propertyId",
            select: "title propertyCode city district price currency rooms grossArea images videoUrl status projectId",
            populate: { path: "projectId", select: "name developer city district status" },
          })
          .populate("agentId", "fullName name")
          .lean(),
      )
    : [];
  const groups = groupByProject(items);

  return (
    <DashboardShell>
      <PageHeader
        action={<UserRoundSearch className="size-5 text-blue-600" />}
        title={t.pageTitle}
        description={t.pageDescription}
      />
      <main className="mx-auto max-w-[1540px] space-y-5 p-4 sm:p-7">
        <section className="app-card overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-l from-blue-50/80 to-white px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <StepNumber number="1" />
              <div>
                <h2 className="font-extrabold text-slate-950">{t.chooseCustomer}</h2>
                <p className="mt-1 text-xs text-slate-500">{t.chooseCustomerNote}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <form action="/matches" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              {scope.effectiveAgentId ? <input name="agentId" type="hidden" value={scope.effectiveAgentId} /> : null}
              <label className="grid gap-1.5 text-xs font-bold text-slate-600">
                {t.customer}
                <select
                  className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500"
                  defaultValue={selectedCustomer?._id || ""}
                  name="customerId"
                  required
                >
                  <option value="">{t.selectCustomerPlaceholder}</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {String(customer.fullName)}{customer.whatsapp ? ` — ${String(customer.whatsapp)}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700"
                type="submit"
              >
                <Sparkles className="size-4" />
                {t.showSuggestions}
              </button>
            </form>

            {session.role !== "AGENT" ? (
              <form action="/matches" className="grid min-w-56 gap-1.5 text-xs font-bold text-slate-600">
                <label htmlFor="agentId">{t.agentScope}</label>
                <div className="flex gap-2">
                  <select
                    className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800"
                    defaultValue={scope.effectiveAgentId || ""}
                    id="agentId"
                    name="agentId"
                  >
                    <option value="">{t.allAgents}</option>
                    {agents.map((agent) => (
                      <option key={agent._id} value={agent._id}>{String(agent.fullName || agent.name)}</option>
                    ))}
                  </select>
                  <button className="h-12 rounded-xl border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50" type="submit">
                    {t.apply}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </section>

        {!selectedCustomer ? (
          <section className="app-card grid min-h-72 place-items-center p-8 text-center">
            <div className="max-w-lg">
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                <UserRoundSearch className="size-8" />
              </div>
              <h2 className="mt-5 text-lg font-extrabold text-slate-950">{t.startTitle}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">{t.startDescription}</p>
            </div>
          </section>
        ) : (
          <>
            <CustomerRequirementCard customer={selectedCustomer} locale={locale} properties={activeProperties} t={t} />

            <section className="app-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <StepNumber number="3" />
                  <div>
                    <h2 className="font-extrabold text-slate-950">{t.suggestedProjects}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {groups.length
                        ? t.resultSummary(groups.length, items.length)
                        : t.noResultSummary}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-3">
                  <details className="relative">
                    <summary className="flex h-9 cursor-pointer list-none items-center rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">
                      {t.resultSettings}
                    </summary>
                    <form className="absolute end-0 top-11 z-10 grid w-64 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                      <input name="customerId" type="hidden" value={String(selectedCustomer._id)} />
                      {scope.effectiveAgentId ? <input name="agentId" type="hidden" value={scope.effectiveAgentId} /> : null}
                      <label className="grid gap-1 text-xs font-bold text-slate-600">
                        {t.minimumScore}
                        <input className="h-10 rounded-lg border border-slate-300 px-3" defaultValue={minimumScore} max="100" min="0" name="minScore" type="number" />
                      </label>
                      <label className="grid gap-1 text-xs font-bold text-slate-600">
                        {t.status}
                        <select className="h-10 rounded-lg border border-slate-300 px-3" defaultValue={status || ""} name="status">
                          <option value="">{t.activeStatuses}</option>
                          {MATCH_STATUSES.map((option) => <option key={option} value={option}>{translateLiteral(option, locale)}</option>)}
                        </select>
                      </label>
                      <button className="h-9 rounded-lg bg-slate-950 text-xs font-bold text-white" type="submit">{t.apply}</button>
                    </form>
                  </details>
                  {groups.length ? <RecalculateMatchesButton customerId={String(selectedCustomer._id)} label={t.findProjects} /> : null}
                </div>
              </div>

              {groups.length ? (
                <div className="space-y-4 p-4 sm:p-6">
                  {groups.map((group) => (
                    <ProjectMatchGroup
                      canDelete={session.role === "ADMIN"}
                      customer={selectedCustomer}
                      group={group}
                      key={group.key}
                      locale={locale}
                      t={t}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid min-h-64 place-items-center p-8 text-center">
                  <div className="max-w-xl">
                    <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                      <CircleAlert className="size-7" />
                    </div>
                    <h3 className="mt-4 font-extrabold text-slate-900">{t.noProjectsTitle}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-500">{t.noProjectsDescription}</p>
                    <div className="mt-4 flex justify-center">
                      <RecalculateMatchesButton customerId={String(selectedCustomer._id)} label={t.findProjects} />
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  );
}

function CustomerRequirementCard({ customer, locale, properties, t }: { customer: DetailRecord; locale: "fa" | "tr"; properties: DetailRecord[]; t: MatchProjectDictionary }) {
  const location = [customer.interestedCity, customer.interestedDistrict].filter(Boolean).join(" / ") || t.notSpecified;
  const rooms = range(customer.minRooms, customer.maxRooms, t.notSpecified);
  const area = range(customer.minArea, customer.maxArea, t.notSpecified, "m²");

  return (
    <section className="app-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-l from-emerald-50/60 to-white px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <StepNumber number="2" />
          <div>
            <p className="text-xs font-bold text-emerald-700">{t.selectedCustomer}</p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-950">{String(customer.fullName)}</h2>
            <p className="mt-1 text-xs text-slate-500" dir="ltr">{String(customer.whatsapp || "")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{translateLiteral(String(customer.status || "-"), locale)}</Badge>
          {properties.length ? <ManualPropertyWhatsApp customer={customer} properties={properties} t={t} /> : <span className="text-xs font-bold text-amber-700">{t.noActiveProperties}</span>}
          <Link className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-white" href={`/customers/${customer._id}`}>
            {t.customerProfile}
            <ArrowLeft className="size-3.5 rtl:rotate-0 ltr:rotate-180" />
          </Link>
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-5">
        <Requirement icon={<MapPin className="size-4" />} label={t.location} value={location} />
        <Requirement icon={<WalletCards className="size-4" />} label={t.budget} value={currency(Number(customer.maxBudget) || undefined, String(customer.currency || "TRY"), locale)} />
        <Requirement icon={<Building2 className="size-4" />} label={t.propertyType} value={translateLiteral(String(customer.propertyType || t.notSpecified), locale)} />
        <Requirement icon={<BedDouble className="size-4" />} label={t.rooms} value={rooms} />
        <Requirement icon={<Ruler className="size-4" />} label={t.area} value={area} />
      </div>
      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">
        {customer.lastMatchedAt ? `${t.lastCalculated}: ${formatGregorianDate(customer.lastMatchedAt, locale)}` : t.notCalculated}
      </div>
    </section>
  );
}

function ManualPropertyWhatsApp({ customer, properties, t }: { customer: DetailRecord; properties: DetailRecord[]; t: MatchProjectDictionary }) {
  const agent = customer.assignedAgentId as DetailRecord | undefined;
  return (
    <WhatsAppComposer
      agent={agent ? { fullName: String(agent.fullName || ""), name: String(agent.name || "") } : undefined}
      buttonLabel={t.chooseAndSendProperty}
      customer={{
        fullName: String(customer.fullName),
        id: String(customer._id),
        phone: customer.phone ? String(customer.phone) : undefined,
        whatsapp: customer.whatsapp ? String(customer.whatsapp) : undefined,
      }}
      preselectedType="PROPERTY"
      properties={properties.map((property) => ({
        city: property.city ? String(property.city) : undefined,
        currency: property.currency ? String(property.currency) : undefined,
        district: property.district ? String(property.district) : undefined,
        grossArea: property.grossArea ? Number(property.grossArea) : undefined,
        id: String(property._id),
        images: Array.isArray(property.images) ? property.images.map(String) : [],
        price: property.price ? Number(property.price) : undefined,
        rooms: property.rooms ? Number(property.rooms) : undefined,
        title: `${String(property.title)}${property.propertyCode ? ` — ${String(property.propertyCode)}` : ""}`,
        videoUrl: property.videoUrl ? String(property.videoUrl) : undefined,
      }))}
    />
  );
}

function Requirement({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">{icon}{label}</div>
      <p className="mt-2 truncate text-sm font-extrabold text-slate-900" title={value}>{value}</p>
    </div>
  );
}

function ProjectMatchGroup({ canDelete, customer, group, locale, t }: { canDelete: boolean; customer: DetailRecord; group: MatchGroup; locale: "fa" | "tr"; t: MatchProjectDictionary }) {
  const bestMatch = group.matches[0];
  const bestReasons = ((bestMatch?.reasons as string[]) || []).slice(0, 2);
  const projectLocation = [group.project?.city, group.project?.district].filter(Boolean).join(" / ");

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4 bg-slate-50/80 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700"><Building2 className="size-5" /></div>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-blue-700">{t.project}</p>
            {group.project ? (
              <Link className="mt-1 block truncate text-base font-extrabold text-slate-950 hover:text-blue-700 hover:underline" href={`/projects/${group.project._id}`}>
                {String(group.project.name)}
              </Link>
            ) : <h3 className="mt-1 font-extrabold text-slate-950">{t.independentProperties}</h3>}
            <p className="mt-1 text-xs text-slate-500">
              {[group.project?.developer, projectLocation].filter(Boolean).join(" · ") || t.noProjectRecord}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center"><p className="text-lg font-black text-slate-950">{group.matches.length}</p><p className="text-[10px] font-bold text-slate-500">{t.suitableUnits}</p></div>
          <MatchScoreBadge label={matchProjectScoreLabel(group.bestScore, locale)} score={group.bestScore} />
        </div>
        {bestReasons.length ? (
          <div className="w-full rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs leading-6 text-emerald-800">
            <strong>{t.whyProject}: </strong>{bestReasons.map((reason) => translateLiteral(reason, locale)).join(" · ")}
          </div>
        ) : null}
      </header>

      <div className="divide-y divide-slate-100">
        {group.matches.map((match) => {
          const property = match.propertyId as DetailRecord | undefined;
          const agent = match.agentId as DetailRecord | undefined;
          const reasons = (match.reasons as string[]) || [];
          const mismatches = (match.mismatches as string[]) || [];
          return (
            <div className="p-4 sm:p-5" key={match._id}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className="font-extrabold text-slate-950 hover:text-blue-700 hover:underline" href={`/properties/${property?._id}`}>
                      {String(property?.title || t.property)}
                    </Link>
                    {property?.propertyCode ? <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{String(property.propertyCode)}</span> : null}
                    <Badge>{translateLiteral(String(match.status), locale)}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{[property?.city, property?.district].filter(Boolean).join(" / ") || "-"}</span>
                    <span>{currency(property?.price as number | undefined, String(property?.currency || "TRY"), locale)}</span>
                    <span>{String(property?.rooms || "-")} {t.room}</span>
                    <span>{String(property?.grossArea || "-")} m²</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <MatchScoreBadge label={matchProjectScoreLabel(Number(match.score || 0), locale)} score={Number(match.score || 0)} />
                  <WhatsAppComposer
                    agent={agent ? { fullName: String(agent.fullName || ""), name: String(agent.name || "") } : undefined}
                    buttonLabel={t.sendWhatsapp}
                    customer={{
                      fullName: String(customer.fullName),
                      id: String(customer._id),
                      phone: customer.phone ? String(customer.phone) : undefined,
                      whatsapp: customer.whatsapp ? String(customer.whatsapp) : undefined,
                    }}
                    matches={[{
                      id: String(match._id),
                      property: {
                        city: property?.city ? String(property.city) : undefined,
                        currency: property?.currency ? String(property.currency) : undefined,
                        district: property?.district ? String(property.district) : undefined,
                        grossArea: property?.grossArea ? Number(property.grossArea) : undefined,
                        id: String(property?._id || ""),
                        images: Array.isArray(property?.images) ? property.images.map(String) : [],
                        price: property?.price ? Number(property.price) : undefined,
                        rooms: property?.rooms ? Number(property.rooms) : undefined,
                        title: String(property?.title || t.property),
                        videoUrl: property?.videoUrl ? String(property.videoUrl) : undefined,
                      },
                      score: Number(match.score || 0),
                    }]}
                    preselectedMatchId={String(match._id)}
                    preselectedType="MATCH"
                  />
                  <Link className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50" href={`/matches/${match._id}`}>
                    {t.fullDetails}
                  </Link>
                </div>
              </div>

              <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm">
                <summary className="cursor-pointer font-bold text-slate-700">{t.whyThisUnit}</summary>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <ReasonList empty={t.noReasons} items={reasons} locale={locale} title={t.matchReasons} tone="positive" />
                  <ReasonList empty={t.noMismatches} items={mismatches} locale={locale} title={t.mismatches} tone="negative" />
                </div>
              </details>
              <div className="mt-3">
                <MatchStatusActions canDelete={canDelete} currentStatus={String(match.status) as never} matchId={String(match._id)} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ReasonList({ empty, items, locale, title, tone }: { empty: string; items: string[]; locale: "fa" | "tr"; title: string; tone: "positive" | "negative" }) {
  return (
    <div>
      <p className={`mb-2 text-xs font-extrabold ${tone === "positive" ? "text-emerald-700" : "text-red-700"}`}>{title}</p>
      <ul className="space-y-1 text-xs leading-6 text-slate-600">
        {items.map((item) => <li key={item}>{tone === "positive" ? "+" : "−"} {translateLiteral(item, locale)}</li>)}
        {!items.length ? <li>{empty}</li> : null}
      </ul>
    </div>
  );
}

function StepNumber({ number }: { number: string }) {
  return <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-black text-white shadow-sm">{number}</span>;
}

function groupByProject(matches: DetailRecord[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();
  for (const match of matches) {
    const property = match.propertyId as DetailRecord | undefined;
    const project = property?.projectId as DetailRecord | undefined;
    const key = project?._id ? String(project._id) : "independent";
    const current = groups.get(key) || { bestScore: 0, key, matches: [], project };
    current.matches.push(match);
    current.bestScore = Math.max(current.bestScore, Number(match.score || 0));
    groups.set(key, current);
  }
  return Array.from(groups.values()).sort((a, b) => b.bestScore - a.bestScore);
}

function clampScore(value?: string) {
  const score = Number(value || MATCH_MIN_SCORE);
  if (!Number.isFinite(score)) return MATCH_MIN_SCORE;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function range(minimum: unknown, maximum: unknown, fallback: string, suffix = "") {
  const min = Number(minimum || 0);
  const max = Number(maximum || 0);
  if (!min && !max) return fallback;
  const value = min && max ? `${min} – ${max}` : String(min || max);
  return suffix ? `${value} ${suffix}` : value;
}

function resolveScope(session: SessionUser, requestedAgentId?: string): { scope?: AgentScope } {
  try {
    return { scope: getAgentScope(session, requestedAgentId) };
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return {};
    throw error;
  }
}
