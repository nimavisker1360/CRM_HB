import Link from "next/link";
import {
  Archive,
  Bell,
  Bot,
  CheckCheck,
  CircleDot,
  FileUp,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  archiveNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationAction,
} from "@/app/notifications/actions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { firstParam, getAgentScope } from "@/lib/auth/agent-scope";
import { canManageTeam } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { formatGregorianDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n-server";
import { localizeNotificationText } from "@/lib/notification-i18n";
import {
  getNotificationSummary,
  getNotifications,
  listNotificationAgents,
} from "@/services/notifications/notification.service";
import type { NotificationCategory, NotificationPriority, NotificationStatus } from "@/services/notifications/notification.types";

export const dynamic = "force-dynamic";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type NotificationRecord = Record<string, unknown> & { _id: string };

const categoryIcons: Record<string, LucideIcon> = {
  AUTOMATION: Bot,
  CUSTOMER: UserRound,
  FOLLOWUP: Bell,
  IMPORT: FileUp,
  MATCH: Sparkles,
};

type NotificationCopy = ReturnType<typeof notificationCopy>;

export default async function NotificationsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const session = await requireSession();
  const locale = await getServerLocale();
  const t = notificationCopy(locale);
  const params = await searchParams;
  const requestedAgentId = firstParam(params.agentId || params.agent);
  const resolved = resolveScope(session, requestedAgentId);

  if (!resolved.scope) {
    return (
      <DashboardShell>
        <AccessDenied message={t.accessDenied} />
      </DashboardShell>
    );
  }

  const scope = resolved.scope;
  const filters = {
    agentId: requestedAgentId,
    category: firstParam(params.category) as NotificationCategory | undefined,
    limit: Number(firstParam(params.limit) || 20),
    page: Number(firstParam(params.page) || 1),
    priority: firstParam(params.priority) as NotificationPriority | undefined,
    q: firstParam(params.q)?.trim(),
    status: firstParam(params.status) as NotificationStatus | undefined,
  };
  const [{ items, pagination }, summary, agents] = await Promise.all([
    getNotifications({ filters, scope, session }),
    getNotificationSummary({ filters: { agentId: requestedAgentId }, scope, session }),
    canManageTeam(session.role) ? listNotificationAgents() : Promise.resolve([]),
  ]);

  const canChooseAgent = canManageTeam(session.role) && !scope.isAdminViewingAgent;
  const agentContext = scope.effectiveAgentId ? t.agentView : canManageTeam(session.role) ? t.companyView : t.myView;
  const statusFilters = [
    { label: t.all, value: "" },
    { label: t.unread, value: "UNREAD" },
    { label: t.read, value: "READ" },
  ];
  const categoryFilters: Array<{ label: string; value: NotificationCategory | "" }> = [
    { label: t.all, value: "" },
    { label: t.match, value: "MATCH" },
    { label: t.followUp, value: "FOLLOWUP" },
    { label: t.customer, value: "CUSTOMER" },
    { label: t.import, value: "IMPORT" },
    { label: t.automation, value: "AUTOMATION" },
    { label: t.system, value: "SYSTEM" },
  ];

  return (
    <DashboardShell>
      <PageHeader
        action={
          <form action={markAllNotificationsReadAction}>
            <input name="agentId" type="hidden" value={requestedAgentId || ""} />
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white" type="submit">
              <CheckCheck className="size-4" />
              {t.markAllRead}
            </button>
          </form>
        }
        title={t.title}
        description={`${t.description} ${agentContext}`}
      />

      <div className="space-y-5 p-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label={t.allNotifications} locale={locale} value={summary.all} />
          <SummaryCard label={t.unread} locale={locale} value={summary.unread} />
          <SummaryCard label={t.today} locale={locale} value={summary.today} />
          <SummaryCard label={t.important} locale={locale} value={summary.important} />
        </section>

        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <form className="grid gap-3 xl:grid-cols-[1.2fr_auto_auto_auto]" action="/notifications">
            {requestedAgentId ? <input name="agentId" type="hidden" value={requestedAgentId} /> : null}
            <label className="relative block">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-10 w-full rounded-md border border-slate-300 pr-9 pl-3 text-sm"
                defaultValue={filters.q || ""}
                name="q"
                placeholder={t.searchPlaceholder}
              />
            </label>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={filters.status || ""} name="status">
              {statusFilters.map((item) => (
                <option key={item.value || "ALL"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={filters.category || ""} name="category">
              {categoryFilters.map((item) => (
                <option key={item.value || "ALL"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <button className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700" type="submit">
              {t.applyFilter}
            </button>
          </form>

          {canChooseAgent ? (
            <form className="flex flex-col gap-2 sm:flex-row" action="/notifications">
              <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={requestedAgentId || ""} name="agentId">
                <option value="">{t.allAgents}</option>
                {agents.map((agent) => (
                  <option key={String(agent._id)} value={String(agent._id)}>
                    {String(agent.fullName || agent.name || agent.email)}
                  </option>
                ))}
              </select>
              <button className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700" type="submit">
                {t.showAgent}
              </button>
            </form>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {items.length ? (
            <div className="divide-y divide-slate-100">
              {(items as NotificationRecord[]).map((notification) => (
                <NotificationRow
                  agentId={requestedAgentId}
                  key={notification._id}
                  locale={locale}
                  notification={notification}
                  showAgent={canManageTeam(session.role) && !scope.effectiveAgentId}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              {filters.status === "UNREAD" ? t.noUnread : t.noNotifications}
            </p>
          )}
        </section>

        <Pagination current={pagination.page} locale={locale} pages={pagination.pages} params={params} t={t} />
      </div>
    </DashboardShell>
  );
}

function NotificationRow({ agentId, locale, notification, showAgent, t }: {
  agentId?: string;
  locale: AppLocale;
  notification: NotificationRecord;
  showAgent: boolean;
  t: NotificationCopy;
}) {
  const unread = notification.status === "UNREAD";
  const CategoryIcon = categoryIcons[String(notification.category)] || Bell;
  const actionUrl = String(notification.actionUrl || "");
  const agent = notification.recipientAgentId as Record<string, unknown> | undefined;

  return (
    <article className={unread ? "bg-sky-50/70" : "bg-white"}>
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[auto_1fr_auto]">
        <div className="flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <CategoryIcon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {unread ? <CircleDot className="size-4 text-sky-600" /> : null}
            <h2 className={unread ? "font-semibold text-slate-950" : "font-medium text-slate-800"}>{localizeNotificationText(String(notification.title), locale)}</h2>
            <Badge tone={priorityTone(String(notification.priority))}>{priorityLabel(String(notification.priority), locale)}</Badge>
            {showAgent && agent ? <Badge tone="blue">{String(agent.fullName || agent.name || agent.email)}</Badge> : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{localizeNotificationText(String(notification.message || notification.body || ""), locale)}</p>
          <p className="mt-2 text-xs text-slate-400">{formatDate(notification.createdAt, locale)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {actionUrl ? (
            <form action={openNotificationAction}>
              <input name="id" type="hidden" value={notification._id} />
              <input name="actionUrl" type="hidden" value={actionUrl} />
              <input name="agentId" type="hidden" value={agentId || ""} />
              <button className="inline-flex h-9 items-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white" type="submit">
                {t.view}
              </button>
            </form>
          ) : null}
          {unread ? (
            <form action={markNotificationReadAction}>
              <input name="id" type="hidden" value={notification._id} />
              <input name="agentId" type="hidden" value={agentId || ""} />
              <button className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" type="submit">
                <CheckCheck className="size-4" />
                {t.markRead}
              </button>
            </form>
          ) : null}
          <form action={archiveNotificationAction}>
            <input name="id" type="hidden" value={notification._id} />
            <input name="agentId" type="hidden" value={agentId || ""} />
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700" type="submit">
              <Archive className="size-4" />
              {t.archive}
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

function SummaryCard({ label, locale, value }: { label: string; locale: AppLocale; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value.toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")}</p>
    </div>
  );
}

function Pagination({ current, locale, pages, params, t }: {
  current: number;
  locale: AppLocale;
  pages: number;
  params: Record<string, string | string[] | undefined>;
  t: NotificationCopy;
}) {
  if (pages <= 1) return null;
  const previous = Math.max(current - 1, 1);
  const next = Math.min(current + 1, pages);
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
      <Link className="text-slate-600 hover:text-slate-950" href={pageHref(params, previous)}>
        {t.previous}
      </Link>
      <span className="text-slate-500">
        {t.page} {current.toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")} {t.of} {pages.toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")}
      </span>
      <Link className="text-slate-600 hover:text-slate-950" href={pageHref(params, next)}>
        {t.next}
      </Link>
    </div>
  );
}

function pageHref(params: Record<string, string | string[] | undefined>, page: number) {
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const value = firstParam(raw);
    if (value && key !== "page") query.set(key, value);
  }
  query.set("page", String(page));
  return `/notifications?${query.toString()}`;
}

function priorityLabel(priority: string, locale: AppLocale) {
  if (locale === "tr") {
    if (priority === "LOW") return "Düşük";
    if (priority === "HIGH") return "Önemli";
    if (priority === "URGENT") return "Acil";
    return "Normal";
  }
  if (priority === "LOW") return "کم";
  if (priority === "HIGH") return "مهم";
  if (priority === "URGENT") return "فوری";
  return "عادی";
}

function priorityTone(priority: string): "amber" | "blue" | "emerald" | "red" | "slate" {
  if (priority === "URGENT" || priority === "HIGH") return "red";
  if (priority === "LOW") return "slate";
  return "emerald";
}

function formatDate(value: unknown, locale: AppLocale) {
  return formatGregorianDateTime(value, locale);
}

function notificationCopy(locale: AppLocale) {
  return locale === "tr" ? {
    accessDenied: "Bu danışmanın bildirimlerine erişim yetkiniz yok.",
    agentView: "Danışman görünümü.",
    all: "Tümü",
    allAgents: "Tüm danışmanlar ve yönetim bildirimleri",
    allNotifications: "Tüm bildirimler",
    applyFilter: "Filtreleri uygula",
    archive: "Arşivle",
    automation: "Otomasyon",
    companyView: "Şirket görünümü.",
    customer: "Müşteri",
    description: "Güvenli sunucu taraflı kapsam ile CRM iç bildirim merkezi.",
    followUp: "Takip",
    import: "Veri aktarımı",
    important: "Önemli",
    markAllRead: "Tümünü okundu işaretle",
    markRead: "Okundu işaretle",
    match: "Eşleşme",
    myView: "Kişisel görünüm.",
    next: "Sonraki",
    noNotifications: "Henüz bildirim bulunmuyor.",
    noUnread: "Okunmamış bildiriminiz yok.",
    of: "/",
    page: "Sayfa",
    previous: "Önceki",
    read: "Okundu",
    searchPlaceholder: "Başlık ve metinde ara",
    showAgent: "Danışmanı göster",
    system: "Sistem",
    title: "Bildirimler",
    today: "Bugün",
    unread: "Okunmadı",
    view: "Görüntüle",
  } : {
    accessDenied: "شما به اعلان‌های این مشاور دسترسی ندارید.",
    agentView: "نمای مشاور.",
    all: "همه",
    allAgents: "همه مشاوران و اعلان‌های مدیریتی",
    allNotifications: "همه اعلان‌ها",
    applyFilter: "اعمال فیلتر",
    archive: "آرشیو",
    automation: "اتوماسیون",
    companyView: "نمای شرکت.",
    customer: "مشتری",
    description: "مرکز اعلان داخلی CRM با محدوده امن سمت سرور.",
    followUp: "پیگیری",
    import: "ورود اطلاعات",
    important: "مهم",
    markAllRead: "خواندن همه",
    markRead: "خوانده شد",
    match: "تطبیق",
    myView: "نمای من.",
    next: "بعدی",
    noNotifications: "هنوز اعلانی وجود ندارد.",
    noUnread: "اعلان خوانده‌نشده‌ای ندارید.",
    of: "از",
    page: "صفحه",
    previous: "قبلی",
    read: "خوانده‌شده",
    searchPlaceholder: "جستجو در عنوان و متن",
    showAgent: "نمایش مشاور",
    system: "سیستم",
    title: "اعلان‌ها",
    today: "امروز",
    unread: "خوانده‌نشده",
    view: "مشاهده",
  };
}

function resolveScope(session: Awaited<ReturnType<typeof requireSession>>, requestedAgentId?: string) {
  try {
    return { scope: getAgentScope(session, requestedAgentId) };
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return {};
    throw error;
  }
}
