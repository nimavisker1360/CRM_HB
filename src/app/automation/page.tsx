import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  CircleGauge,
  Clock,
  DatabaseZap,
  Info,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { AutomationRunButton } from "@/components/automation/AutomationRunButton";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { requireSession } from "@/lib/auth/session";
import {
  automationDuration,
  automationHealthLabel,
  automationJobEffect,
  automationJobText,
  automationScheduleLabel,
  automationStatusLabel,
  automationTriggerLabel,
} from "@/lib/automation-i18n";
import { compactNumber, formatGregorianDateTime } from "@/lib/format";
import { getServerLocale } from "@/lib/i18n-server";
import { getAutomationDashboardData } from "@/services/automation/automation.service";

export const dynamic = "force-dynamic";

type HistoryRow = Record<string, unknown> & { supersededBySuccess: boolean };
type Locale = "fa" | "tr";

export default async function AutomationPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");
  const locale = await getServerLocale();
  const t = locale === "tr" ? {
    automaticRun: "Otomatik çalışma",
    basedOnErrors: "Son 7 günün sonuçlarına göre",
    description: "CRM'in arka planda yaptığı işleri görün ve gerektiğinde elle çalıştırın.",
    details: "Ayrıntılar",
    empty: "Henüz bir çalışma kaydedilmedi.",
    failedRuns: "Kontrol gerekli",
    failedRunsNote: "Son 7 gündeki başarısız çalışmalar",
    history: "Son çalışmalar",
    historyNote: "Her işin ne zaman çalıştığını ve sonucunu burada görebilirsiniz.",
    intro: "Bu işler belirtilen saatlerde kendiliğinden çalışır. Yalnızca hemen güncelleme gerektiğinde “Elle çalıştır”ı kullanın; onaydan önce yapılacak değişiklikleri göreceksiniz.",
    introTitle: "Bilmeniz gerekenler",
    job: "Yapılan iş",
    lastRun: "Son çalışma",
    noRun: "Henüz çalışmadı",
    pending: "Kontrol sırası",
    result: "Sonuç",
    running: "Şu anda çalışan",
    runningNote: "Devam eden işler",
    status: "Durum",
    systemHealth: "Genel durum",
    time: "Çalışma zamanı",
    title: "CRM otomatik işleri",
    trigger: "Nasıl çalıştı?",
    whatHappens: "Bu iş ne yapar?",
  } : {
    automaticRun: "اجرای خودکار",
    basedOnErrors: "بر اساس نتیجه ۷ روز اخیر",
    description: "کارهایی را ببینید که CRM در پس‌زمینه انجام می‌دهد و در صورت نیاز آن‌ها را دستی اجرا کنید.",
    details: "دیدن جزئیات",
    empty: "هنوز هیچ اجرایی ثبت نشده است.",
    failedRuns: "نیازمند بررسی",
    failedRunsNote: "اجرای ناموفق در ۷ روز اخیر",
    history: "آخرین اجراها",
    historyNote: "اینجا می‌بینید هر کار چه زمانی اجرا شده و نتیجه‌اش چه بوده است.",
    intro: "این کارها در زمان مشخص به‌صورت خودکار انجام می‌شوند. فقط وقتی نتیجه‌ی تازه را همین حالا نیاز دارید از «اجرای دستی» استفاده کنید؛ پیش از تأیید، تغییرات را به شما نشان می‌دهیم.",
    introTitle: "نکته مهم برای ادمین",
    job: "کار انجام‌شده",
    lastRun: "آخرین اجرا",
    noRun: "هنوز اجرا نشده",
    pending: "در صف بررسی",
    result: "نتیجه",
    running: "در حال انجام",
    runningNote: "کارهایی که هنوز تمام نشده‌اند",
    status: "وضعیت",
    systemHealth: "وضعیت کلی",
    time: "زمان اجرا",
    title: "کارهای خودکار CRM",
    trigger: "نحوه اجرا",
    whatHappens: "این کار چه تغییری ایجاد می‌کند؟",
  };

  const data = await getAutomationDashboardData();
  const historyRows = annotateHistory(data.history as Array<Record<string, unknown>>);
  const pendingNote = locale === "tr"
    ? `${compactNumber(data.summary.pendingCustomers, locale)} müşteri, ${compactNumber(data.summary.pendingProperties, locale)} gayrimenkul, ${compactNumber(data.summary.pendingImports, locale)} aktarım`
    : `${compactNumber(data.summary.pendingCustomers, locale)} مشتری، ${compactNumber(data.summary.pendingProperties, locale)} ملک، ${compactNumber(data.summary.pendingImports, locale)} فایل ورودی`;

  return (
    <DashboardShell>
      <PageHeader title={t.title} description={t.description} />
      <div className="space-y-6 p-4 sm:p-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={data.health === "Healthy" ? CheckCircle2 : AlertTriangle}
            label={t.systemHealth}
            value={automationHealthLabel(data.health, locale)}
            note={t.basedOnErrors}
          />
          <StatCard icon={PlayCircle} label={t.running} value={compactNumber(data.summary.runningJobs, locale)} note={t.runningNote} />
          <StatCard icon={DatabaseZap} label={t.pending} value={compactNumber(data.summary.pendingAutomationItems, locale)} note={pendingNote} />
          <StatCard icon={AlertTriangle} label={t.failedRuns} value={compactNumber(data.summary.failedJobs, locale)} note={t.failedRunsNote} />
        </section>

        <section className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
            <Info className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold">{t.introTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-blue-900">{t.intro}</p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {data.definitions.map((definition) => {
            const lastRun = definition.lastRun as Record<string, unknown> | null;
            const definitionText = automationJobText(definition.type, locale, definition.name, definition.description);
            const effect = automationJobEffect(definition.type, locale);
            return (
              <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={definition.type}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-950">{definitionText.name}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{definitionText.description}</p>
                  </div>
                  <Badge tone={toneForStatus(String(lastRun?.status || "PENDING"))}>
                    {lastRun ? automationStatusLabel(String(lastRun.status), locale) : t.noRun}
                  </Badge>
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Sparkles className="size-4 text-blue-600" aria-hidden="true" />
                    {t.whatHappens}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{effect}</p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <JobInfo
                    icon={CalendarClock}
                    label={t.automaticRun}
                    value={automationScheduleLabel(definition.type, locale, definition.schedule)}
                  />
                  <JobInfo
                    icon={CircleGauge}
                    label={t.lastRun}
                    value={lastRun ? formatGregorianDateTime(lastRun.startedAt, locale) : t.noRun}
                    note={lastRun ? automationRunSummary(lastRun, locale) : undefined}
                  />
                </div>

                <div className="mt-auto flex justify-end pt-5">
                  <AutomationRunButton
                    effect={effect}
                    heavy={definition.heavy}
                    name={definitionText.name}
                    type={definition.type}
                  />
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-950">{t.history}</h2>
              <p className="mt-1 text-sm text-slate-500">{t.historyNote}</p>
            </div>
            <Clock className="size-5 text-slate-400" aria-hidden="true" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-start text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">{t.job}</th>
                  <th className="px-5 py-3 font-medium">{t.trigger}</th>
                  <th className="px-5 py-3 font-medium">{t.time}</th>
                  <th className="px-5 py-3 font-medium">{t.status}</th>
                  <th className="px-5 py-3 font-medium">{t.result}</th>
                  <th className="px-5 py-3"><span className="sr-only">{t.details}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyRows.map((job) => (
                  <tr key={String(job._id)} className="align-middle">
                    <td className="px-5 py-4 font-semibold text-slate-950">
                      {automationJobText(String(job.type), locale, String(job.name || "")).name}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{automationTriggerLabel(String(job.triggerType), locale)}</td>
                    <td className="px-5 py-4 text-slate-600">
                      <p>{formatGregorianDateTime(job.startedAt, locale)}</p>
                      <p className="mt-1 text-xs text-slate-400">{automationDuration(Number(job.durationMs || 0), locale)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={job.supersededBySuccess ? "emerald" : toneForStatus(String(job.status))}>
                        {job.supersededBySuccess
                          ? (locale === "tr" ? "Sonraki çalışmada tamamlandı" : "در اجرای بعدی کامل شد")
                          : automationStatusLabel(String(job.status), locale)}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{automationRunSummary(job, locale)}</td>
                    <td className="px-5 py-4 text-end">
                      <Link className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900" href={`/automation/${job._id}`}>
                        {t.details}
                        <ChevronLeft className="size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!data.history.length ? (
                  <tr>
                    <td className="px-5 py-8 text-sm text-slate-500" colSpan={6}>{t.empty}</td>
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

function JobInfo({
  icon: Icon,
  label,
  note,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  note?: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
        {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
      </div>
    </div>
  );
}

function automationRunSummary(job: Record<string, unknown>, locale: Locale) {
  const status = String(job.status || "");
  const processed = Number(job.processedCount || 0);
  const success = Number(job.successCount || 0);
  const failed = Number(job.failedCount || 0);
  const number = (value: number) => compactNumber(value, locale);

  if (status === "RUNNING") return locale === "tr" ? "Kayıtlar kontrol ediliyor…" : "در حال بررسی رکوردها…";
  if (status === "FAILED" && processed === 0) return locale === "tr" ? "İş başlatılamadı" : "کار انجام نشد";
  if (processed === 0) return locale === "tr" ? "Yapılacak bir kayıt bulunmadı" : "موردی برای انجام پیدا نشد";
  if (failed > 0) {
    return locale === "tr"
      ? `${number(success)} tamamlandı, ${number(failed)} hata`
      : `${number(success)} مورد انجام شد، ${number(failed)} خطا`;
  }
  return locale === "tr" ? `${number(success || processed)} kayıt tamamlandı` : `${number(success || processed)} مورد با موفقیت انجام شد`;
}

function toneForStatus(status: string) {
  if (status === "SUCCESS") return "emerald";
  if (status === "FAILED") return "red";
  if (status === "PARTIAL" || status === "RUNNING") return "amber";
  return "slate";
}

function annotateHistory(history: Array<Record<string, unknown>>): HistoryRow[] {
  const completedTypes = new Set<string>();

  return history.map((job) => {
    const type = String(job.type || "");
    const status = String(job.status || "");
    const supersededBySuccess = status === "PARTIAL" && completedTypes.has(type);

    if (status === "SUCCESS") completedTypes.add(type);

    return { ...job, supersededBySuccess } as HistoryRow;
  });
}
