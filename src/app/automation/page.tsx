import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, DatabaseZap, PlayCircle } from "lucide-react";
import { AutomationRunButton } from "@/components/automation/AutomationRunButton";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { requireSession } from "@/lib/auth/session";
import { compactNumber, formatGregorianDateTime } from "@/lib/format";
import { getServerLocale } from "@/lib/i18n-server";
import { automationDuration, automationHealthLabel, automationJobText, automationStatusLabel, automationTriggerLabel } from "@/lib/automation-i18n";
import { getAutomationDashboardData } from "@/services/automation/automation.service";

export const dynamic = "force-dynamic";

type HistoryRow = Record<string, unknown> & { supersededBySuccess: boolean };

export default async function AutomationPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");
  const locale = await getServerLocale();
  const t = locale === "tr" ? {
    basedOnErrors: "Son hatalara göre", completedLater: "Daha sonra tamamlandı", description: "Zamanlanmış CRM işleri, çalışma durumları ve işlem geçmişi.",
    duration: "Süre", empty: "Henüz bir otomasyon çalışması kaydedilmedi.", failed: "Başarısız", failedRuns: "Başarısız çalışmalar",
    history: "Çalışma geçmişi", historyNote: "Her satır ayrı bir çalışmadır; eski satırlar işin güncel durumunu göstermez.", job: "İş",
    lastRun: "Son çalışma", pending: "Bekleyen öğeler", pendingImport: "bekleyen veri aktarımı", processed: "İşlenen", runId: "Çalışma kimliği",
    running: "Çalışıyor", runningNote: "Kilitli işler", schedule: "UTC zamanlaması", start: "Başlangıç", status: "Durum",
    success: "Başarılı", systemHealth: "Sistem sağlığı", title: "Otomasyon", trigger: "Çalıştırma türü", sevenDays: "Son 7 gün",
  } : {
    basedOnErrors: "بر اساس خطاهای اخیر", completedLater: "تکمیل‌شده بعداً", description: "کارهای زمان‌بندی‌شده CRM، وضعیت اجرا و تاریخچه پردازش‌ها.",
    duration: "مدت زمان", empty: "هنوز اجرای اتوماسیون ثبت نشده است.", failed: "ناموفق", failedRuns: "اجراهای ناموفق",
    history: "تاریخچه اجراها", historyNote: "هر ردیف یک اجرای جداگانه است؛ ردیف‌های قدیمی وضعیت فعلی کار را نشان نمی‌دهند.", job: "کار",
    lastRun: "آخرین اجرا", pending: "موارد در انتظار", pendingImport: "ورودی در انتظار", processed: "پردازش‌شده", runId: "شناسه اجرا",
    running: "در حال اجرا", runningNote: "کارهای قفل‌شده", schedule: "زمان‌بندی UTC", start: "شروع", status: "وضعیت",
    success: "موفق", systemHealth: "سلامت سیستم", title: "اتوماسیون", trigger: "نوع اجرا", sevenDays: "۷ روز اخیر",
  };

  const data = await getAutomationDashboardData();
  const historyRows = annotateHistory(data.history as Array<Record<string, unknown>>);

  return (
    <DashboardShell>
      <PageHeader title={t.title} description={t.description} />
      <div className="space-y-6 p-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={data.health === "Healthy" ? CheckCircle2 : AlertTriangle}
            label={t.systemHealth}
            value={automationHealthLabel(data.health, locale)}
            note={t.basedOnErrors}
          />
          <StatCard icon={PlayCircle} label={t.running} value={compactNumber(data.summary.runningJobs, locale)} note={t.runningNote} />
          <StatCard icon={AlertTriangle} label={t.failedRuns} value={compactNumber(data.summary.failedJobs, locale)} note={t.sevenDays} />
          <StatCard
            icon={DatabaseZap}
            label={t.pending}
            value={compactNumber(data.summary.pendingAutomationItems, locale)}
            note={`${compactNumber(data.summary.pendingImports, locale)} ${t.pendingImport}`}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {data.definitions.map((definition) => {
            const lastRun = definition.lastRun as Record<string, unknown> | null;
            const definitionText = automationJobText(definition.type, locale, definition.name, definition.description);
            return (
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={definition.type}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-slate-950">{definitionText.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{definitionText.description}</p>
                  </div>
                  <Badge tone={toneForStatus(String(lastRun?.status || "PENDING"))}>{automationStatusLabel(String(lastRun?.status || "PENDING"), locale)}</Badge>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Metric label={t.lastRun} value={formatGregorianDateTime(lastRun?.startedAt, locale)} />
                  <Metric label={t.duration} value={automationDuration(Number(lastRun?.durationMs || 0), locale)} />
                  <Metric label={t.processed} value={compactNumber(Number(lastRun?.processedCount || 0), locale)} />
                  <Metric label={t.failed} value={compactNumber(Number(lastRun?.failedCount || 0), locale)} />
                </dl>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">{t.schedule}: {definition.schedule || "-"}</p>
                  <AutomationRunButton heavy={definition.heavy} type={definition.type} />
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-950">{t.history}</h2>
              <p className="text-sm text-slate-500">{t.historyNote}</p>
            </div>
            <Clock className="size-5 text-slate-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-start text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">{t.job}</th>
                  <th className="px-5 py-3 font-medium">{t.runId}</th>
                  <th className="px-5 py-3 font-medium">{t.trigger}</th>
                  <th className="px-5 py-3 font-medium">{t.status}</th>
                  <th className="px-5 py-3 font-medium">{t.start}</th>
                  <th className="px-5 py-3 font-medium">{t.processed}</th>
                  <th className="px-5 py-3 font-medium">{t.success}</th>
                  <th className="px-5 py-3 font-medium">{t.failed}</th>
                  <th className="px-5 py-3 font-medium">{t.duration}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyRows.map((job) => (
                  <tr key={String(job._id)} className="align-top">
                    <td className="px-5 py-4 font-medium text-slate-950">
                      <Link className="hover:underline" href={`/automation/${job._id}`}>
                        {automationJobText(String(job.type), locale, String(job.name || "")).name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500" dir="ltr">{shortRunId(job.runId)}</td>
                    <td className="px-5 py-4 text-slate-600">{automationTriggerLabel(String(job.triggerType), locale)}</td>
                    <td className="px-5 py-4">
                      <Badge tone={job.supersededBySuccess ? "emerald" : toneForStatus(String(job.status))}>
                        {job.supersededBySuccess ? t.completedLater : automationStatusLabel(String(job.status), locale)}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatGregorianDateTime(job.startedAt, locale)}</td>
                    <td className="px-5 py-4 text-slate-600">{compactNumber(Number(job.processedCount || 0), locale)}</td>
                    <td className="px-5 py-4 text-slate-600">{compactNumber(Number(job.successCount || 0), locale)}</td>
                    <td className="px-5 py-4 text-slate-600">{compactNumber(Number(job.failedCount || 0), locale)}</td>
                    <td className="px-5 py-4 text-slate-600">{automationDuration(Number(job.durationMs || 0), locale)}</td>
                  </tr>
                ))}
                {!data.history.length ? (
                  <tr>
                    <td className="px-5 py-8 text-sm text-slate-500" colSpan={9}>
                      {t.empty}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function toneForStatus(status: string) {
  if (status === "SUCCESS") return "emerald";
  if (status === "FAILED") return "red";
  if (status === "PARTIAL" || status === "RUNNING") return "amber";
  return "slate";
}

function shortRunId(value: unknown) {
  const runId = String(value || "");
  if (!runId) return "-";
  const parts = runId.split("-");
  return parts.length >= 2 ? `#${parts.at(-1)}` : `#${runId.slice(-8)}`;
}

function annotateHistory(history: Array<Record<string, unknown>>): HistoryRow[] {
  const completedTypes = new Set<string>();

  return history.map((job) => {
    const type = String(job.type || "");
    const status = String(job.status || "");
    const supersededBySuccess = status === "PARTIAL" && completedTypes.has(type);

    if (status === "SUCCESS") {
      completedTypes.add(type);
    }

    return { ...job, supersededBySuccess } as HistoryRow;
  });
}
