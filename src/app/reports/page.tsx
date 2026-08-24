import Link from "next/link";
import { BadgeCheck, CalendarCheck, CircleDollarSign, ClockAlert, Handshake, LineChart, Send, Sparkles, UserCheck, UserPlus, Users, XCircle } from "lucide-react";
import { ReportCharts } from "@/components/reports/ReportCharts";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { firstParam } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { translateLiteral, type AppLocale } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n-server";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { serializeMongo } from "@/lib/serialize";
import { resolveReportFilters } from "@/services/reports/report.filters";
import { getReportAgents, getReportsData } from "@/services/reports/report.service";
import type { AgentPerformanceSort, ReportFilters, ReportsData } from "@/services/reports/report.types";

export const dynamic = "force-dynamic";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const RANGE_OPTIONS = [
  ["TODAY", "امروز"], ["LAST_7_DAYS", "۷ روز اخیر"], ["LAST_30_DAYS", "۳۰ روز اخیر"],
  ["THIS_MONTH", "این ماه"], ["LAST_MONTH", "ماه گذشته"], ["CUSTOM", "بازه سفارشی"],
] as const;

const SORT_OPTIONS: Array<[AgentPerformanceSort, string]> = [
  ["MOST_WON", "بیشترین فروش موفق"], ["BEST_CONVERSION", "بهترین نرخ تبدیل"],
  ["MOST_COMPLETED_FOLLOWUPS", "بیشترین پیگیری تکمیل‌شده"], ["MOST_NEW_LEADS", "بیشترین سرنخ جدید"],
  ["MOST_MEETINGS", "بیشترین جلسه"], ["MOST_OVERDUE", "بیشترین عقب‌افتادگی"],
];

export default async function ReportsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const session = await requireSession();
  const locale = await getServerLocale();
  const r = (value: string) => reportText(value, locale);
  const params = await searchParams;
  const requestedAgentId = firstParam(params.agentId || params.agent);
  if (requestedAgentId && !objectIdOrUndefined(requestedAgentId)) return <Denied message={r("شناسه مشاور معتبر نیست.")} />;

  const rawFilters: ReportFilters = {
    agentId: requestedAgentId,
    dateFrom: firstParam(params.dateFrom),
    dateTo: firstParam(params.dateTo),
    range: firstParam(params.range),
    sort: firstParam(params.sort),
  };
  let validationMessage = "";
  let resolved;
  try {
    resolved = resolveReportFilters(session, rawFilters);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return <Denied message={r("مشاور نمی‌تواند با تغییر پارامتر URL گزارش مشاور دیگری را مشاهده کند.")} />;
    if (error instanceof Error && error.message === "INVALID_CUSTOM_DATE_RANGE") {
      validationMessage = r("بازه سفارشی معتبر نیست؛ تاریخ شروع باید قبل از پایان و حداکثر ۳۶۶ روز باشد. گزارش ۳۰ روز اخیر نمایش داده شد.");
      resolved = resolveReportFilters(session, { agentId: requestedAgentId, range: "LAST_30_DAYS", sort: rawFilters.sort });
    } else throw error;
  }

  const [report, selectorAgents] = await Promise.all([getReportsData(resolved), session.role === "AGENT" ? Promise.resolve([]) : getReportAgents()]);
  const agents = serializeMongo(selectorAgents);
  const isAgentReport = Boolean(report.effectiveAgentId);
  const selectedAgent = agents.find((agent) => String(agent._id) === report.effectiveAgentId);
  const selectedAgentName = session.role === "AGENT" ? session.name : String(selectedAgent?.fullName || selectedAgent?.name || r("مشاور"));

  return (
    <DashboardShell>
      <PageHeader
        action={<span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"><LineChart className="size-4" /> {r("داده واقعی MongoDB")}</span>}
        title={isAgentReport ? `${r("گزارش عملکرد")} ${selectedAgentName}` : r("گزارش مدیریتی شرکت")}
        description={`${r(report.dateWindow.label)}; ${r("محاسبه‌شده در محدوده امن")} ${isAgentReport ? r("مشاور") : r("کل شرکت")} ${r("و منطقه زمانی Europe/Istanbul.")}`}
      />
      <main className="space-y-6 p-4 sm:p-6">
        <ReportFilterForm agents={agents} canSelectAgent={session.role !== "AGENT"} dateFrom={rawFilters.dateFrom || toDateInput(report.dateWindow.from)} dateTo={rawFilters.dateTo || toDateInput(new Date(new Date(report.dateWindow.to).getTime() - 1).toISOString())} range={report.dateWindow.range} selectedAgentId={report.effectiveAgentId || ""} sort={resolved.sort} />
        {validationMessage ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{validationMessage}</div> : null}

        <section aria-labelledby="kpi-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div><h2 id="kpi-heading" className="font-semibold text-slate-950">{r("شاخص‌های کلیدی")}</h2><p className="text-sm text-slate-500">{r("تمام شاخص‌ها در بازه و scope انتخاب‌شده محاسبه شده‌اند.")}</p></div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900" title={r("تعداد مشتریان موفق تقسیم بر مشتریان واجد شرایط یا مراحل بعدی در بازه انتخاب‌شده")}>{r("نرخ تبدیل کل")}: <strong>{formatPercent(report.overallConversionRate)}</strong></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <Kpi icon={Users} label="کل سرنخ‌ها" value={report.kpis.totalLeads} note="مشتریان ثبت‌شده در بازه" href={customerHref(report)} />
            <Kpi icon={UserPlus} label="سرنخ جدید" value={report.kpis.newLeads} note="وضعیت NEW_LEAD" href={customerHref(report, "NEW_LEAD")} />
            <Kpi icon={UserCheck} label="مشتریان فعال" value={report.kpis.activeCustomers} note="وضعیت‌های فعال pipeline" href={customerHref(report)} />
            <Kpi icon={BadgeCheck} label="واجد شرایط" value={report.kpis.qualifiedCustomers} note="وضعیت QUALIFIED" href={customerHref(report, "QUALIFIED")} />
            <Kpi icon={Send} label="ملک ارسال‌شده" value={report.kpis.propertySent} note="وضعیت PROPERTY_SENT" href={customerHref(report, "PROPERTY_SENT")} />
            <Kpi icon={CalendarCheck} label="جلسات" value={report.kpis.meetings} note="وضعیت MEETING" href={customerHref(report, "MEETING")} />
            <Kpi icon={Handshake} label="مذاکرات" value={report.kpis.negotiations} note="وضعیت NEGOTIATION" href={customerHref(report, "NEGOTIATION")} />
            <Kpi icon={CircleDollarSign} label="موفق" value={report.kpis.won} note="وضعیت WON" href={customerHref(report, "WON")} />
            <Kpi icon={XCircle} label="ناموفق" value={report.kpis.lost} note="وضعیت LOST" href={customerHref(report, "LOST")} />
            <Kpi icon={CalendarCheck} label="پیگیری تکمیل‌شده" value={report.kpis.followUpsCompleted} note="completedAt در بازه" href={followUpHref(report, "status=COMPLETED")} />
            <Kpi icon={ClockAlert} label="پیگیری عقب‌افتاده" value={report.kpis.overdueFollowUps} note="باز و گذشته از موعد" href={followUpHref(report, "bucket=overdue")} danger />
            <Kpi icon={Sparkles} label="تطبیق جدید" value={report.kpis.newMatches} note="وضعیت NEW" href={matchHref(report, "NEW")} />
            <Kpi icon={Sparkles} label="تطبیق علاقه‌مند" value={report.kpis.interestedMatches} note="وضعیت INTERESTED" href={matchHref(report, "INTERESTED")} />
          </div>
        </section>

        <ReportCharts agents={session.role === "AGENT" ? [] : report.agents} districts={report.demand.districts} funnel={report.funnel} leadSources={report.leadSources} timeSeries={report.timeSeries} />

        <section className="grid gap-5 xl:grid-cols-2">
          <Panel title="تبدیل مراحل قیف" description="نرخ هر مرحله نسبت به مرحله قبلی؛ تقسیم بر صفر به‌صورت ۰٪ مدیریت می‌شود.">
            <div className="divide-y divide-slate-100">{report.funnel.map((stage, index) => <div className="flex items-center justify-between gap-4 py-3 text-sm" key={stage.status}><span className="font-medium text-slate-700">{r(stage.label)}</span><span className="flex items-center gap-4"><strong>{formatNumber(stage.count)}</strong>{index ? <span className="w-16 text-left text-slate-500">{formatPercent(stage.conversionFromPrevious || 0)}</span> : null}</span></div>)}</div>
          </Panel>
          <Panel title="عملکرد پیگیری" description="نرخ تکمیل = پیگیری‌های تکمیل‌شده در بازه ÷ کل پیگیری‌های سررسیدشده در بازه."><MetricGrid items={[["کل پیگیری‌ها", report.followUps.total], ["تکمیل‌شده", report.followUps.completed], ["در انتظار", report.followUps.pending], ["عقب‌افتاده", report.followUps.overdue], ["نرخ تکمیل", formatPercent(report.followUps.completionRate)]]} /></Panel>
          <Panel title="عملکرد تطبیق" description="تطبیق قوی با threshold مرکزی Matching Config محاسبه می‌شود."><MetricGrid items={[["کل تطبیق‌ها", report.matches.total], ["جدید", report.matches.new], ["ارسال‌شده", report.matches.sent], ["علاقه‌مند", report.matches.interested], ["ردشده", report.matches.rejected], ["جلسه", report.matches.meeting], ["تطبیق قوی", report.matches.strong], ["میانگین امتیاز", report.matches.averageScore], ["ارسال ← علاقه", formatPercent(report.matches.interestConversion)], ["علاقه ← جلسه", formatPercent(report.matches.meetingConversion)]]} /></Panel>
          <Panel title="انضباط پاسخ‌گویی" description="تعریف عدم فعالیت دقیقاً همان منطق مشترک Automation است."><MetricGrid items={[["مشتریان فعال", report.discipline.activeCustomers], ["دارای پیگیری", report.discipline.customersWithUpcomingFollowUp], ["بدون پیگیری", report.discipline.customersWithoutUpcomingFollowUp], ["مشتریان غیرفعال", report.discipline.inactiveCustomers], ["نرخ عقب‌افتادگی", formatPercent(report.discipline.overdueRate)]]} /></Panel>
        </section>

        {session.role !== "AGENT" ? <AgentPerformanceTable report={report} /> : null}

        <section className="grid gap-5 xl:grid-cols-2">
          <SimpleTable title="Pipeline مشتریان" headers={["وضعیت", "تعداد"]} empty="مشتری‌ای در این بازه ثبت نشده است." rows={report.pipeline.map((row) => [row.status, row.count])} />
          <SimpleTable title="منابع سرنخ" headers={["منبع", "سرنخ", "واجد شرایط", "موفق", "تبدیل"]} empty="در این بازه منبع سرنخی ثبت نشده است." rows={report.leadSources.map((row) => [row.source, row.leads, row.qualified, row.won, formatPercent(row.conversionRate)])} />
          <SimpleTable title="شهرهای پرتقاضا" headers={["شهر", "تعداد", "سهم"]} empty="تقاضای شهری ثبت نشده است." rows={report.demand.cities.map((row) => [row.label, row.count, formatPercent(row.percentage)])} />
          <SimpleTable title="نوع ملک درخواستی" headers={["نوع", "تعداد", "سهم"]} empty="نوع ملک درخواستی ثبت نشده است." rows={report.demand.propertyTypes.map((row) => [row.label, row.count, formatPercent(row.percentage)])} />
          <SimpleTable title="نوع معامله" headers={["نوع", "تعداد", "سهم"]} empty="نوع معامله‌ای ثبت نشده است." rows={report.demand.transactionTypes.map((row) => [row.label, row.count, formatPercent(row.percentage)])} />
          <SimpleTable title="تعداد اتاق درخواستی" headers={["اتاق", "تعداد", "سهم"]} empty="نیاز اتاق قابل‌محاسبه‌ای ثبت نشده است." rows={report.demand.rooms.map((row) => [row.label, row.count, formatPercent(row.percentage)])} />
        </section>

        <Panel title="تحلیل بودجه بر اساس ارز" description="ارزها هرگز با یکدیگر جمع یا میانگین‌گیری نشده‌اند.">
          {report.budgets.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{report.budgets.map((budget) => <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={budget.currency}><div className="flex items-center justify-between"><strong>{budget.currency}</strong><span className="text-xs text-slate-500">{formatNumber(budget.count)} {r("رکورد")}</span></div><dl className="mt-3 grid gap-2 text-sm"><BudgetRow label="میانگین" value={formatCurrency(budget.average, budget.currency)} /><BudgetRow label="میانه" value={formatCurrency(budget.median, budget.currency)} /><BudgetRow label="کمینه" value={formatCurrency(budget.minimum, budget.currency)} /><BudgetRow label="بیشینه" value={formatCurrency(budget.maximum, budget.currency)} /></dl></div>)}</div> : <Empty text="بودجه قابل‌محاسبه‌ای در این بازه وجود ندارد." />}
        </Panel>

        <section className="grid gap-5 xl:grid-cols-2">
          <SimpleTable title="املاک برتر" headers={["ملک", "تطبیق", "ارسال", "علاقه", "جلسه", "میانگین"]} empty="تطبیقی برای رتبه‌بندی املاک وجود ندارد." rows={report.topProperties.map((row) => [<Link className="font-medium hover:underline" href={`/properties/${row.propertyId}`} key={row.propertyId}>{row.title}<small className="block text-slate-400">{row.code}</small></Link>, row.matches, row.sent, row.interested, row.meetings, formatPercent(row.averageScore)])} />
          <SimpleTable title="بالاترین میانگین امتیاز تطبیق" headers={["ملک", "میانگین", "نمونه", "علاقه"]} empty="امتیاز تطبیقی برای رتبه‌بندی وجود ندارد." rows={report.highestScoreProperties.map((row) => [<Link className="font-medium hover:underline" href={`/properties/${row.propertyId}`} key={row.propertyId}>{row.title}</Link>, formatPercent(row.averageScore), row.matches, row.interested])} />
          <SimpleTable title="پروژه‌های برتر" headers={["پروژه", "واحد", "فعال", "تطبیق", "علاقه", "جلسه", "موفق"]} empty="داده پروژه‌ای برای این بازه وجود ندارد." rows={report.topProjects.map((row) => [<Link className="font-medium hover:underline" href={`/projects/${row.projectId}`} key={row.projectId}>{row.name}</Link>, row.totalUnits, row.activeUnits, row.matches, row.interestedCustomers, row.meetings, row.wonDeals])} />
        </section>

        <Panel title="املاک فعال بدون تطبیق" description="فایل‌های فعالی که در بازه و محدوده انتخاب‌شده هیچ تطبیقی ندارند.">
          {report.propertiesWithoutMatch.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{report.propertiesWithoutMatch.map((property) => <Link className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-400" href={`/properties/${property.propertyId}`} key={property.propertyId}><strong className="block text-sm">{property.title}</strong><span className="mt-1 block text-xs text-slate-500">{property.code} · {property.city} / {property.district}</span></Link>)}</div> : <Empty text="همه املاک فعال در این محدوده حداقل یک تطبیق دارند." />}
        </Panel>
      </main>
    </DashboardShell>
  );
}

async function ReportFilterForm({ agents, canSelectAgent, dateFrom, dateTo, range, selectedAgentId, sort }: { agents: Array<Record<string, unknown>>; canSelectAgent: boolean; dateFrom: string; dateTo: string; range: string; selectedAgentId: string; sort: AgentPerformanceSort }) {
  const locale = await getServerLocale(); const r = (value: string) => reportText(value, locale);
  return <form className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" action="/reports"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><label className="grid gap-1 text-xs font-medium text-slate-600">{r("بازه زمانی")}<select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue={range} name="range">{RANGE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{r(label)}</option>)}</select></label><label className="grid gap-1 text-xs font-medium text-slate-600">{r("از تاریخ")}<input className="h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={dateFrom} dir="ltr" lang="en-GB" name="dateFrom" type="date" /></label><label className="grid gap-1 text-xs font-medium text-slate-600">{r("تا تاریخ")}<input className="h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={dateTo} dir="ltr" lang="en-GB" name="dateTo" type="date" /></label>{canSelectAgent ? <label className="grid gap-1 text-xs font-medium text-slate-600">{r("مشاور")}<select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue={selectedAgentId} name="agentId"><option value="">{r("همه مشاوران")}</option>{agents.map((agent) => <option value={String(agent._id)} key={String(agent._id)}>{String(agent.fullName || agent.name || agent.email)}</option>)}</select></label> : null}{canSelectAgent ? <label className="grid gap-1 text-xs font-medium text-slate-600">{r("مرتب‌سازی مشاوران")}<select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue={sort} name="sort">{SORT_OPTIONS.map(([value, label]) => <option value={value} key={value}>{r(label)}</option>)}</select></label> : null}<button className="mt-auto h-10 rounded-md bg-slate-950 px-5 text-sm font-medium text-white" type="submit">{r("اعمال فیلترها")}</button></div><p className="mt-3 text-xs text-slate-500">{r("برای بازه سفارشی گزینه «بازه سفارشی» را انتخاب کنید؛ فیلترها در URL ذخیره می‌شوند.")}</p></form>;
}

async function Kpi({ danger = false, href, icon: Icon, label, note, value }: { danger?: boolean; href: string; icon: typeof Users; label: string; note: string; value: number }) {
  const locale = await getServerLocale();
  return <Link className={`rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${danger && value ? "border-red-300" : "border-slate-200"}`} href={href}><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-500">{reportText(label, locale)}</span><span className={`flex size-9 items-center justify-center rounded-lg ${danger && value ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}><Icon className="size-4" /></span></div><strong className="mt-3 block text-2xl text-slate-950">{formatNumber(value)}</strong><span className="mt-1 block text-xs text-slate-500">{reportText(note, locale)} · {reportText("مشاهده جزئیات", locale)}</span></Link>;
}
async function Panel({ children, description, title }: { children: React.ReactNode; description: string; title: string }) { const locale = await getServerLocale(); return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-950">{reportText(title, locale)}</h2><p className="mt-1 text-sm text-slate-500">{reportText(description, locale)}</p><div className="mt-4">{children}</div></section>; }
async function MetricGrid({ items }: { items: Array<[string, number | string]> }) { const locale = await getServerLocale(); return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map(([label, value]) => <div className="rounded-lg bg-slate-50 p-3" key={label}><dt className="text-xs text-slate-500">{reportText(label, locale)}</dt><dd className="mt-1 font-semibold text-slate-900">{typeof value === "number" ? formatNumber(value, 1) : value}</dd></div>)}</dl>; }
async function AgentPerformanceTable({ report }: { report: ReportsData }) { const locale = await getServerLocale(); return <SimpleTable title="عملکرد مشاوران" headers={["مشاور", "مشتری", "سرنخ", "واجد", "پیگیری", "تکمیل", "عقب‌افتاده", "تطبیق", "علاقه", "جلسه", "مذاکره", "موفق", "ناموفق", "تبدیل"]} empty="مشاوری برای نمایش وجود ندارد." rows={report.agents.map((row) => [<Link className="font-medium hover:underline" href={`/agents/${row.agentId}/performance`} key={row.agentId}>{row.agentName}</Link>, row.customers, row.newLeads, row.qualified, row.followUps, row.completedFollowUps, row.overdue, row.matches, row.interested, row.meetings, row.negotiations, row.won, row.lost, <span title={reportText("موفق تقسیم بر واجد شرایط", locale)} key={`${row.agentId}-conversion`}>{formatPercent(row.conversionRate)}</span>])} />; }
async function SimpleTable({ empty, headers, rows, title }: { empty: string; headers: string[]; rows: React.ReactNode[][]; title: string }) { const locale = await getServerLocale(); return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-950">{reportText(title, locale)}</h2></div>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-max text-start text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{headers.map((header) => <th className="px-4 py-3 font-medium" key={header}>{reportText(header, locale)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td className="px-4 py-3 text-slate-700" key={cellIndex}>{typeof cell === "number" ? formatNumber(cell) : typeof cell === "string" ? reportText(cell, locale) : cell}</td>)}</tr>)}</tbody></table></div> : <Empty text={empty} />}</section>; }
async function BudgetRow({ label, value }: { label: string; value: string }) { const locale = await getServerLocale(); return <div className="flex justify-between gap-3"><dt className="text-slate-500">{reportText(label, locale)}</dt><dd className="font-medium" dir="ltr">{value}</dd></div>; }
async function Empty({ text }: { text: string }) { const locale = await getServerLocale(); return <p className="p-6 text-sm text-slate-500">{reportText(text, locale)}</p>; }
function Denied({ message }: { message: string }) { return <DashboardShell><AccessDenied message={message} /></DashboardShell>; }
function toDateInput(value: string) { return new Date(new Date(value).getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function customerHref(report: ReportsData, status?: string) { const params = new URLSearchParams(); if (status) params.set("status", status); if (report.effectiveAgentId) params.set("assignedAgentId", report.effectiveAgentId); return `/customers${params.size ? `?${params}` : ""}`; }
function followUpHref(report: ReportsData, query: string) { const params = new URLSearchParams(query); if (report.effectiveAgentId) params.set("agentId", report.effectiveAgentId); return `/follow-ups?${params}`; }
function matchHref(report: ReportsData, status: string) { const params = new URLSearchParams({ status }); if (report.effectiveAgentId) params.set("agentId", report.effectiveAgentId); return `/matches?${params}`; }

const REPORT_TR: Record<string, string> = {
  "امروز": "Bugün", "۷ روز اخیر": "Son 7 gün", "۳۰ روز اخیر": "Son 30 gün", "این ماه": "Bu ay", "ماه گذشته": "Geçen ay", "بازه سفارشی": "Özel aralık",
  "بیشترین فروش موفق": "En çok başarılı satış", "بهترین نرخ تبدیل": "En iyi dönüşüm oranı", "بیشترین پیگیری تکمیل‌شده": "En çok tamamlanan takip",
  "بیشترین سرنخ جدید": "En çok yeni fırsat", "بیشترین جلسه": "En çok görüşme", "بیشترین عقب‌افتادگی": "En çok gecikme",
  "شناسه مشاور معتبر نیست.": "Danışman kimliği geçerli değil.", "مشاور نمی‌تواند با تغییر پارامتر URL گزارش مشاور دیگری را مشاهده کند.": "Danışman URL parametresini değiştirerek başka bir danışmanın raporunu görüntüleyemez.",
  "بازه سفارشی معتبر نیست؛ تاریخ شروع باید قبل از پایان و حداکثر ۳۶۶ روز باشد. گزارش ۳۰ روز اخیر نمایش داده شد.": "Özel aralık geçerli değil; başlangıç tarihi bitişten önce olmalı ve aralık en fazla 366 gün olmalıdır. Son 30 gün raporu gösteriliyor.",
  "داده واقعی MongoDB": "Gerçek MongoDB verisi", "گزارش عملکرد": "Performans raporu", "گزارش مدیریتی شرکت": "Şirket yönetim raporu", "محاسبه‌شده در محدوده امن": "güvenli kapsamda hesaplandı:",
  "مشاور": "Danışman", "کل شرکت": "Tüm şirket", "و منطقه زمانی Europe/Istanbul.": "ve Europe/Istanbul saat dilimi.", "شاخص‌های کلیدی": "Temel göstergeler",
  "تمام شاخص‌ها در بازه و scope انتخاب‌شده محاسبه شده‌اند.": "Tüm göstergeler seçilen aralık ve kapsamda hesaplanmıştır.",
  "تعداد مشتریان موفق تقسیم بر مشتریان واجد شرایط یا مراحل بعدی در بازه انتخاب‌شده": "Seçilen aralıkta başarılı müşterilerin nitelikli veya sonraki aşamadaki müşterilere oranı",
  "نرخ تبدیل کل": "Genel dönüşüm oranı", "کل سرنخ‌ها": "Toplam fırsat", "مشتریان ثبت‌شده در بازه": "Aralıkta kaydedilen müşteriler", "سرنخ جدید": "Yeni fırsat",
  "مشتریان فعال": "Etkin müşteriler", "وضعیت‌های فعال pipeline": "Etkin satış hunisi durumları", "واجد شرایط": "Nitelikli", "ملک ارسال‌شده": "Gayrimenkul gönderildi",
  "جلسات": "Görüşmeler", "مذاکرات": "Müzakereler", "موفق": "Başarılı", "ناموفق": "Başarısız", "پیگیری تکمیل‌شده": "Tamamlanan takip",
  "پیگیری عقب‌افتاده": "Gecikmiş takip", "باز و گذشته از موعد": "Açık ve süresi geçmiş", "تطبیق جدید": "Yeni eşleşme", "تطبیق علاقه‌مند": "İlgilenilen eşleşme",
  "تبدیل مراحل قیف": "Huni aşaması dönüşümü", "نرخ هر مرحله نسبت به مرحله قبلی؛ تقسیم بر صفر به‌صورت ۰٪ مدیریت می‌شود.": "Her aşamanın önceki aşamaya göre oranı; sıfıra bölme %0 olarak işlenir.",
  "عملکرد پیگیری": "Takip performansı", "نرخ تکمیل = پیگیری‌های تکمیل‌شده در بازه ÷ کل پیگیری‌های سررسیدشده در بازه.": "Tamamlanma oranı = aralıktaki tamamlanan takipler ÷ aralıktaki vadesi gelen tüm takipler.",
  "کل پیگیری‌ها": "Toplam takip", "تکمیل‌شده": "Tamamlandı", "در انتظار": "Bekliyor", "عقب‌افتاده": "Gecikmiş", "نرخ تکمیل": "Tamamlanma oranı",
  "عملکرد تطبیق": "Eşleşme performansı", "تطبیق قوی با threshold مرکزی Matching Config محاسبه می‌شود.": "Güçlü eşleşme merkezi eşleştirme eşiğiyle hesaplanır.",
  "کل تطبیق‌ها": "Toplam eşleşme", "جدید": "Yeni", "ارسال‌شده": "Gönderildi", "علاقه‌مند": "İlgileniyor", "ردشده": "Reddedildi", "جلسه": "Görüşme",
  "تطبیق قوی": "Güçlü eşleşme", "میانگین امتیاز": "Ortalama puan", "ارسال ← علاقه": "Gönderim ← ilgi", "علاقه ← جلسه": "İlgi ← görüşme",
  "انضباط پاسخ‌گویی": "Takip disiplini", "تعریف عدم فعالیت دقیقاً همان منطق مشترک Automation است.": "Etkin olmama tanımı otomasyonla aynı ortak mantığı kullanır.",
  "دارای پیگیری": "Takibi olan", "بدون پیگیری": "Takipsiz", "مشتریان غیرفعال": "Etkin olmayan müşteriler", "نرخ عقب‌افتادگی": "Gecikme oranı",
  "Pipeline مشتریان": "Müşteri satış hunisi", "وضعیت": "Durum", "تعداد": "Sayı", "مشتری‌ای در این بازه ثبت نشده است.": "Bu aralıkta müşteri kaydedilmedi.",
  "منابع سرنخ": "Fırsat kaynakları", "منبع": "Kaynak", "سرنخ": "Fırsat", "تبدیل": "Dönüşüm", "در این بازه منبع سرنخی ثبت نشده است.": "Bu aralıkta fırsat kaynağı kaydedilmedi.",
  "شهرهای پرتقاضا": "En çok talep edilen şehirler", "شهر": "Şehir", "سهم": "Pay", "تقاضای شهری ثبت نشده است.": "Şehir talebi kaydedilmedi.",
  "نوع ملک درخواستی": "Talep edilen gayrimenkul türü", "نوع": "Tür", "نوع ملک درخواستی ثبت نشده است.": "Talep edilen gayrimenkul türü kaydedilmedi.",
  "نوع معامله": "İşlem türü", "نوع معامله‌ای ثبت نشده است.": "İşlem türü kaydedilmedi.", "تعداد اتاق درخواستی": "Talep edilen oda sayısı", "اتاق": "Oda", "نیاز اتاق قابل‌محاسبه‌ای ثبت نشده است.": "Hesaplanabilir oda ihtiyacı kaydedilmedi.",
  "تحلیل بودجه بر اساس ارز": "Para birimine göre bütçe analizi", "ارزها هرگز با یکدیگر جمع یا میانگین‌گیری نشده‌اند.": "Para birimleri hiçbir zaman birlikte toplanmaz veya ortalaması alınmaz.",
  "رکورد": "kayıt", "میانگین": "Ortalama", "میانه": "Medyan", "کمینه": "En düşük", "بیشینه": "En yüksek", "بودجه قابل‌محاسبه‌ای در این بازه وجود ندارد.": "Bu aralıkta hesaplanabilir bütçe yok.",
  "املاک برتر": "En iyi gayrimenkuller", "ملک": "Gayrimenkul", "تطبیق": "Eşleşme", "ارسال": "Gönderim", "علاقه": "İlgi", "تطبیقی برای رتبه‌بندی املاک وجود ندارد.": "Gayrimenkulleri sıralamak için eşleşme yok.",
  "بالاترین میانگین امتیاز تطبیق": "En yüksek ortalama eşleşme puanı", "نمونه": "Örnek", "امتیاز تطبیقی برای رتبه‌بندی وجود ندارد.": "Sıralama için eşleşme puanı yok.",
  "پروژه‌های برتر": "En iyi projeler", "پروژه": "Proje", "واحد": "Birim", "فعال": "Etkin", "داده پروژه‌ای برای این بازه وجود ندارد.": "Bu aralıkta proje verisi yok.",
  "املاک فعال بدون تطبیق": "Eşleşmesi olmayan etkin gayrimenkuller", "فایل‌های فعالی که در بازه و محدوده انتخاب‌شده هیچ تطبیقی ندارند.": "Seçilen aralık ve kapsamda eşleşmesi olmayan etkin kayıtlar.",
  "همه املاک فعال در این محدوده حداقل یک تطبیق دارند.": "Bu kapsamdaki tüm etkin gayrimenkullerin en az bir eşleşmesi var.",
  "بازه زمانی": "Tarih aralığı", "از تاریخ": "Başlangıç tarihi", "تا تاریخ": "Bitiş tarihi", "همه مشاوران": "Tüm danışmanlar", "مرتب‌سازی مشاوران": "Danışman sıralaması",
  "اعمال فیلترها": "Filtreleri uygula", "برای بازه سفارشی گزینه «بازه سفارشی» را انتخاب کنید؛ فیلترها در URL ذخیره می‌شوند.": "Özel tarih aralığı için “Özel aralık” seçeneğini seçin; filtreler URL'de saklanır.",
  "مشاهده جزئیات": "Ayrıntıları görüntüle", "عملکرد مشاوران": "Danışman performansı", "مشتری": "Müşteri", "واجد": "Nitelikli", "پیگیری": "Takip", "تکمیل": "Tamamlanan",
  "مذاکره": "Müzakere", "مشاوری برای نمایش وجود ندارد.": "Görüntülenecek danışman yok.", "موفق تقسیم بر واجد شرایط": "Başarılı ÷ nitelikli",
};

function reportText(value: string, locale: AppLocale) {
  if (locale === "fa") return value;
  return REPORT_TR[value] || translateLiteral(value, locale);
}
