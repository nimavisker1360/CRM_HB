import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck, Sparkles, Users } from "lucide-react";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { AgentAvatar } from "@/components/crm/AgentAvatar";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { requireSession } from "@/lib/auth/session";
import { compactNumber } from "@/lib/format";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { translateLiteral } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n-server";
import { connectToDatabase } from "@/lib/mongodb";
import { Agent, Activity, Customer, FollowUp, PropertyMatch } from "@/models";
import { serializeMongo } from "@/lib/serialize";
import { getBusinessTodayBounds } from "@/services/automation/automation-date";

export const dynamic = "force-dynamic";

type DetailRecord = Record<string, unknown> & { _id: string };

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");
  const locale = await getServerLocale();
  await connectToDatabase();
  const { id } = await params;
  const _id = objectIdOrUndefined(id);
  if (!_id) notFound();

  const agent = serializeMongo(await Agent.findById(_id).lean<DetailRecord | null>());
  if (!agent) notFound();

  const t = locale === "tr" ? {
    agent: "Danışman",
    assignedCustomers: "Atanan müşteriler",
    currentOwner: "Mevcut sorumlu",
    email: "E-posta",
    languages: "Diller",
    matches: "Eşleşmeler",
    matchesNote: "Etkin eşleşme kayıtları",
    overdue: "Gecikenler",
    overdueNote: "Bekleyen veya açık ve süresi geçmiş",
    pageDescription: "Danışman profili, veri sorumluluğu göstergeleri ve kişisel panele erişim.",
    performanceReport: "Performans raporu",
    phone: "Telefon",
    role: "Rol",
    specializedCities: "Uzmanlık şehirleri",
    status: "Durum",
    todayFollowUps: "Bugünkü takipler",
    todayFollowUpsNote: "Bugün için bekleyen veya açık",
    viewDashboard: "Paneli görüntüle",
  } : {
    agent: "مشاور",
    assignedCustomers: "مشتریان اختصاص‌داده‌شده",
    currentOwner: "مالک فعلی",
    email: "ایمیل",
    languages: "زبان‌ها",
    matches: "تطبیق‌ها",
    matchesNote: "رکوردهای تطبیق فعال",
    overdue: "عقب‌افتاده",
    overdueNote: "در انتظار یا باز و گذشته از موعد",
    pageDescription: "پروفایل مشاور، شاخص‌های مالکیت داده و ورود به پنل اختصاصی.",
    performanceReport: "گزارش عملکرد",
    phone: "تلفن",
    role: "نقش",
    specializedCities: "شهرهای تخصصی",
    status: "وضعیت",
    todayFollowUps: "پیگیری‌های امروز",
    todayFollowUpsNote: "در انتظار یا باز برای امروز",
    viewDashboard: "مشاهده پنل",
  };
  const agentName = String(agent.fullName || agent.name || t.agent);
  const languages = Array.isArray(agent.languages)
    ? agent.languages.map((language) => translateLiteral(String(language), locale)).join(", ")
    : agent.languages
      ? translateLiteral(String(agent.languages), locale)
      : "-";

  const today = getBusinessTodayBounds();
  const [customers, followUpsToday, overdueFollowUps, matches, activities] = await Promise.all([
    Customer.countDocuments({ assignedAgentId: _id }),
    FollowUp.countDocuments({ agentId: _id, status: { $in: ["PENDING", "OPEN"] }, scheduledAt: { $gte: today.start, $lt: today.end } }),
    FollowUp.countDocuments({ agentId: _id, status: { $in: ["PENDING", "OPEN", "OVERDUE"] }, scheduledAt: { $lt: new Date() } }),
    PropertyMatch.countDocuments({ agentId: _id, status: { $ne: "ARCHIVED" } }),
    Activity.find({ entityType: "AGENT", entityId: _id }).sort({ createdAt: -1 }).limit(20).lean<DetailRecord[]>(),
  ]);

  return (
    <DashboardShell>
      <PageHeader
        action={
          <div className="flex flex-wrap items-center gap-3">
            <AgentAvatar className="size-24 text-xl shadow-md ring-2 ring-blue-100" name={agentName} src={agent.avatarDataUrl} />
            <div className="flex items-center gap-2">
              <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" href={`/agents/${id}/performance`}>{t.performanceReport}</Link>
              <Link className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={`/agents/${id}/dashboard`}>{t.viewDashboard}</Link>
            </div>
          </div>
        }
        title={agentName}
        description={t.pageDescription}
      />
      <div className="space-y-5 p-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            {([
              [t.email, agent.email],
              [t.phone, agent.phone],
              [t.role, translateLiteral(String(agent.role || "-"), locale)],
              [t.status, translateLiteral(String(agent.status || "-"), locale)],
              [t.languages, languages],
              [t.specializedCities, Array.isArray(agent.specializedCities) ? agent.specializedCities.join(", ") : agent.specializedCities],
            ] as Array<[string, unknown]>).map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="mt-1 font-medium text-slate-900">{String(value || "-")}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label={t.assignedCustomers} value={compactNumber(customers, locale)} note={t.currentOwner} />
          <StatCard icon={CalendarCheck} label={t.todayFollowUps} value={compactNumber(followUpsToday, locale)} note={t.todayFollowUpsNote} />
          <StatCard icon={CalendarCheck} label={t.overdue} value={compactNumber(overdueFollowUps, locale)} note={t.overdueNote} />
          <StatCard icon={Sparkles} label={t.matches} value={compactNumber(matches, locale)} note={t.matchesNote} />
        </section>

        <ActivityTimeline activities={serializeMongo(activities)} locale={locale} />
      </div>
    </DashboardShell>
  );
}
