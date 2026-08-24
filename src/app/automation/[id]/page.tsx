import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Bot, CheckCircle2, Clock3, DatabaseZap, XCircle, type LucideIcon } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { requireSession } from "@/lib/auth/session";
import { formatGregorianDateTime } from "@/lib/format";
import { getServerLocale } from "@/lib/i18n-server";
import { automationDuration, automationJobText, automationStatusLabel, automationTriggerLabel } from "@/lib/automation-i18n";
import { getAutomationJobDetail } from "@/services/automation/automation.service";

export const dynamic = "force-dynamic";

export default async function AutomationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");
  const locale = await getServerLocale();
  const t = locale === "tr" ? {
    batches: "Gruplar", completed: "Bitiş", description: "Otomasyon çalışmasının ayrıntıları ve işlem sonucu", detail: "İşlem ayrıntıları",
    detailNote: "İşe ait ek bilgilerin okunabilir görünümü", duration: "Çalışma süresi", emptyMetadata: "Bu çalışma için ek ayrıntı kaydedilmedi.",
    failed: "Başarısız", failedNote: "Hata veren kayıtlar", finish: "Bitiş", jobType: "İş türü", metadata: {
      cutoff: "Etkin olmama zaman sınırı", dayKey: "İş günü", end: "Aralık sonu", eventsCreated: "Hazırlanan olaylar", lastProcessedId: "Son işlenen kayıt",
      matchCalculationVersion: "Eşleşme hesaplama sürümü", processedImportJobs: "İşlenen veri aktarımları", remainingCount: "Kalan",
      savedMatches: "Kaydedilen eşleşmeler", start: "Aralık başlangıcı",
    },
    noError: "Bu çalışmada kayıtlı hata yok.", noIssues: "Hatasız", needsReview: "İnceleme gerekli", processed: "İşlenen", processedNote: "İncelenen toplam kayıt",
    processingResult: "İşlem sonucu", processingResultNote: "Ham teknik veri gösterilmeden çıktı durumu", rejected: "Atlanan", rejectedNote: "kayıt atlandı",
    runId: "Çalışma kimliği", start: "Başlangıç", status: "Durum", success: "Başarılı", successRate: "Başarı oranı",
    summary: "Çalışma özeti", summaryNote: "Bu otomasyon çalışmasının temel bilgileri", trigger: "Çalıştırma türü", back: "Otomasyona dön",
  } : {
    batches: "دسته‌ها", completed: "پایان", description: "جزئیات اجرای اتوماسیون و نتیجه پردازش", detail: "جزئیات پردازش",
    detailNote: "اطلاعات تکمیلی کار به صورت خوانا", duration: "مدت اجرا", emptyMetadata: "جزئیات تکمیلی برای این اجرا ثبت نشده است.",
    failed: "ناموفق", failedNote: "رکوردهایی که خطا داشتند", finish: "پایان", jobType: "نوع کار", metadata: {
      cutoff: "مرز زمانی غیرفعال بودن", dayKey: "روز کاری", end: "پایان بازه", eventsCreated: "رویدادهای آماده‌شده", lastProcessedId: "آخرین رکورد پردازش‌شده",
      matchCalculationVersion: "نسخه محاسبه تطبیق", processedImportJobs: "ورودی‌های پردازش‌شده", remainingCount: "باقی‌مانده",
      savedMatches: "تطبیق‌های ذخیره‌شده", start: "شروع بازه",
    },
    noError: "این اجرا خطای ثبت‌شده ندارد.", noIssues: "بدون خطا", needsReview: "نیازمند بررسی", processed: "پردازش‌شده", processedNote: "کل رکوردهای بررسی‌شده",
    processingResult: "نتیجه پردازش", processingResultNote: "وضعیت خروجی بدون نمایش داده خام فنی", rejected: "ردشده", rejectedNote: "رکورد رد شد",
    runId: "شناسه اجرا", start: "شروع", status: "وضعیت", success: "موفق", successRate: "نرخ موفقیت",
    summary: "خلاصه اجرا", summaryNote: "اطلاعات اصلی این اجرای اتوماسیون", trigger: "نوع اجرا", back: "بازگشت به اتوماسیون",
  };

  const { id } = await params;
  const job = await getAutomationJobDetail(id);
  if (!job) notFound();

  const metadataRows = metadataToRows(job.metadata, locale, t.metadata);
  const processed = Number(job.processedCount || 0);
  const success = Number(job.successCount || 0);
  const failed = Number(job.failedCount || 0);
  const skipped = Number(job.skippedCount || 0);
  const successRate = processed > 0 ? Math.round((success / processed) * 100) : 0;

  return (
    <DashboardShell>
      <PageHeader title={automationJobText(String(job.type), locale, String(job.name || "")).name} description={t.description} />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950" href="/automation">
            <ArrowRight className="size-4" aria-hidden="true" />
            {t.back}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={toneForStatus(String(job.status))}>{automationStatusLabel(String(job.status), locale)}</Badge>
            <span className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
              {t.runId}
              <span className="mr-2 inline-block max-w-[260px] truncate align-bottom font-mono text-slate-700" dir="ltr">
                {String(job.runId)}
              </span>
            </span>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={DatabaseZap} label={t.processed} value={formatNumber(processed, locale)} note={t.processedNote} />
          <SummaryCard icon={CheckCircle2} label={t.success} value={formatNumber(success, locale)} note={`${formatNumber(successRate, locale)}% ${t.successRate}`} />
          <SummaryCard icon={XCircle} label={t.failed} value={formatNumber(failed, locale)} note={t.failedNote} />
          <SummaryCard icon={Clock3} label={t.duration} value={automationDuration(Number(job.durationMs || 0), locale)} note={`${formatNumber(skipped, locale)} ${t.rejectedNote}`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <Bot className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold text-slate-950">{t.summary}</h2>
                <p className="text-sm text-slate-500">{t.summaryNote}</p>
              </div>
            </div>
            <dl className="divide-y divide-slate-100">
              <InfoRow label={t.jobType} value={automationJobText(String(job.type), locale, String(job.name || "")).name} />
              <InfoRow label={t.trigger} value={automationTriggerLabel(String(job.triggerType), locale)} />
              <InfoRow label={t.status} value={automationStatusLabel(String(job.status), locale)} />
              <InfoRow label={t.start} value={formatGregorianDateTime(job.startedAt, locale)} />
              <InfoRow label={t.finish} value={formatGregorianDateTime(job.completedAt, locale)} />
              <InfoRow label={t.batches} value={formatNumber(Number(job.batchCount || 0), locale)} />
            </dl>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-950">{t.processingResult}</h2>
                <p className="text-sm text-slate-500">{t.processingResultNote}</p>
              </div>
              <Badge tone={failed > 0 ? "amber" : "emerald"}>{failed > 0 ? t.needsReview : t.noIssues}</Badge>
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{t.successRate}</span>
                  <span className="font-semibold text-slate-950">{formatNumber(successRate, locale)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${successRate}%` }} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniMetric label={t.success} value={formatNumber(success, locale)} />
                <MiniMetric label={t.failed} value={formatNumber(failed, locale)} />
                <MiniMetric label={t.rejected} value={formatNumber(skipped, locale)} />
              </div>
              {job.errorMessage ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {String(job.errorMessage)}
                </div>
              ) : (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  {t.noError}
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-950">{t.detail}</h2>
            <p className="text-sm text-slate-500">{t.detailNote}</p>
          </div>
          {metadataRows.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {metadataRows.map((row) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4" key={row.label}>
                  <p className="text-xs font-medium text-slate-500">{row.label}</p>
                  <p className="mt-2 break-words text-sm font-semibold text-slate-950">{row.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              {t.emptyMetadata}
            </p>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

function SummaryCard({ icon: Icon, label, note, value }: { icon: LucideIcon; label: string; note: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-left text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function formatNumber(value: number, locale: "fa" | "tr") {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn").format(value);
}

function toneForStatus(status: string) {
  if (status === "SUCCESS") return "emerald";
  if (status === "FAILED") return "red";
  if (status === "PARTIAL" || status === "RUNNING") return "amber";
  return "slate";
}

function metadataToRows(metadata: unknown, locale: "fa" | "tr", labels: Record<string, string>) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const record = metadata as Record<string, unknown>;
  return Object.entries(record)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({
      label: labels[key] || key,
      value: formatMetadataValue(value, locale),
    }));
}

function formatMetadataValue(value: unknown, locale: "fa" | "tr"): string {
  if (value instanceof Date) return formatGregorianDateTime(value, locale);
  if (typeof value === "number") return formatNumber(value, locale);
  if (typeof value === "string") {
    const maybeDate = new Date(value);
    if (!Number.isNaN(maybeDate.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatGregorianDateTime(value, locale);
    return value;
  }
  if (Array.isArray(value)) return value.length ? value.map((item) => String(item)).join(", ") : "-";
  if (typeof value === "object" && value) return JSON.stringify(value);
  return String(value);
}
