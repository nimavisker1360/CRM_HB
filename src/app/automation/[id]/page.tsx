import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  CircleGauge,
  Info,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { requireSession } from "@/lib/auth/session";
import {
  automationDuration,
  automationJobEffect,
  automationJobText,
  automationStatusLabel,
  automationTriggerLabel,
} from "@/lib/automation-i18n";
import { formatGregorianDateTime } from "@/lib/format";
import { getServerLocale } from "@/lib/i18n-server";
import { getAutomationJobDetail } from "@/services/automation/automation.service";

export const dynamic = "force-dynamic";

type Locale = "fa" | "tr";
type JobRecord = Record<string, unknown>;

export default async function AutomationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");
  const locale = await getServerLocale();
  const t = locale === "tr" ? {
    back: "Otomatik işlere dön",
    batches: "İşlem grubu sayısı",
    description: "Bu çalışmada ne yapıldığını sade bir özetle görün.",
    duration: "Ne kadar sürdü?",
    emptyMetadata: "Bu çalışma için ek teknik bilgi kaydedilmedi.",
    executionInfo: "Ne zaman ve nasıl çalıştı?",
    executionInfoNote: "Çalışmanın zamanı ve kim tarafından başlatıldığı",
    failed: "Hata oluşan",
    finish: "Bitiş",
    initiatedBy: "Başlatan",
    processed: "Kontrol edilen",
    resultTitle: "Bu çalışmanın sonucu",
    runId: "Teknik çalışma kimliği",
    skipped: "Atlanan",
    start: "Başlangıç",
    success: "Hatasız tamamlanan",
    technical: "Destek için teknik bilgiler",
    technicalNote: "Çalışma kimliği, işlem sayıları ve sistem ayrıntıları",
    whatChanged: "Bu iş CRM'de neyi değiştirdi?",
    whatChangedNote: "İşin yaptığı değişikliğin kısa açıklaması",
    metadata: {
      cutoff: "Hareketsizlik kontrolünün başlangıç tarihi",
      dayKey: "İş günü",
      end: "Kontrol aralığının sonu",
      eventsCreated: "Oluşturulan uyarı veya hatırlatmalar",
      lastProcessedId: "Son işlenen kaydın teknik kimliği",
      matchCalculationVersion: "Öneri hesaplama sürümü",
      processedImportJobs: "Kontrol edilen aktarımlar",
      remainingCount: "Sonraki çalışmaya kalan",
      savedMatches: "Kaydedilen öneriler",
      start: "Kontrol aralığının başlangıcı",
    },
  } : {
    back: "بازگشت به کارهای خودکار",
    batches: "تعداد بخش‌های پردازش",
    description: "نتیجه‌ی این اجرا را با یک توضیح ساده و قابل‌فهم ببینید.",
    duration: "چقدر طول کشید؟",
    emptyMetadata: "برای این اجرا اطلاعات فنی بیشتری ثبت نشده است.",
    executionInfo: "چه زمانی و چگونه اجرا شد؟",
    executionInfoNote: "زمان اجرا و شخص یا سیستمی که آن را شروع کرده است",
    failed: "نیازمند بررسی",
    finish: "زمان پایان",
    initiatedBy: "شروع‌کننده",
    processed: "موارد بررسی‌شده",
    resultTitle: "نتیجه این اجرا",
    runId: "شناسه فنی اجرا",
    skipped: "موارد کنارگذاشته‌شده",
    start: "زمان شروع",
    success: "بدون خطا انجام‌شده",
    technical: "اطلاعات فنی برای پشتیبانی",
    technicalNote: "شناسه اجرا، تعداد پردازش‌ها و جزئیات داخلی سیستم",
    whatChanged: "این کار در CRM چه تغییری ایجاد کرد؟",
    whatChangedNote: "توضیح کوتاه درباره کاری که سیستم انجام داده است",
    metadata: {
      cutoff: "شروع بازه مشتریان بدون فعالیت",
      dayKey: "روز کاری",
      end: "پایان بازه بررسی",
      eventsCreated: "هشدار یا یادآوری ساخته‌شده",
      lastProcessedId: "شناسه فنی آخرین رکورد",
      matchCalculationVersion: "نسخه محاسبه پیشنهادها",
      processedImportJobs: "فایل‌های ورودی بررسی‌شده",
      remainingCount: "باقی‌مانده برای اجرای بعدی",
      savedMatches: "پیشنهادهای ذخیره‌شده",
      start: "شروع بازه بررسی",
    },
  };

  const { id } = await params;
  const fetchedJob = await getAutomationJobDetail(id);
  if (!fetchedJob) notFound();
  const job = fetchedJob as JobRecord;
  const type = String(job.type || "");
  const status = String(job.status || "");
  const jobText = automationJobText(type, locale, String(job.name || ""));
  const result = buildResultCopy(job, locale);
  const technicalRows = buildTechnicalRows(job, locale, t);
  const needsAttention = status === "FAILED" || status === "PARTIAL" || Number(job.failedCount || 0) > 0;
  const isRunning = status === "RUNNING" || status === "PENDING";
  const ResultIcon = needsAttention ? CircleAlert : isRunning ? CircleGauge : CheckCircle2;

  return (
    <DashboardShell>
      <PageHeader title={jobText.name} description={t.description} />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950" href="/automation">
            <ArrowRight className="size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
            {t.back}
          </Link>
          <Badge tone={toneForStatus(status)}>{automationStatusLabel(status, locale)}</Badge>
        </div>

        <section className={resultPanelClass(needsAttention, isRunning)}>
          <span className={resultIconClass(needsAttention, isRunning)}>
            <ResultIcon className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold opacity-70">{t.resultTitle}</p>
            <h2 className="mt-1 text-xl font-black leading-8">{result.title}</h2>
            <p className="mt-2 text-sm leading-7 opacity-85">{result.description}</p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Info className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-bold text-slate-950">{t.whatChanged}</h2>
                <p className="mt-1 text-sm text-slate-500">{t.whatChangedNote}</p>
              </div>
            </div>
            <p className="mt-5 rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm leading-7 text-slate-700">
              {automationJobEffect(type, locale)}
            </p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <CalendarClock className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-bold text-slate-950">{t.executionInfo}</h2>
                <p className="mt-1 text-sm text-slate-500">{t.executionInfoNote}</p>
              </div>
            </div>
            <dl className="mt-4 divide-y divide-slate-100">
              <InfoRow icon={UserRound} label={t.initiatedBy} value={executionSource(job, locale)} />
              <InfoRow icon={CalendarClock} label={t.start} value={formatGregorianDateTime(job.startedAt, locale)} />
              <InfoRow icon={CalendarClock} label={t.finish} value={formatGregorianDateTime(job.completedAt, locale)} />
              <InfoRow icon={CircleGauge} label={t.duration} value={automationDuration(Number(job.durationMs || 0), locale)} />
            </dl>
          </article>
        </section>

        {job.errorMessage ? (
          <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-bold">{locale === "tr" ? "Bu çalışma neden tamamlanamadı?" : "چرا این اجرا کامل نشد؟"}</h2>
                <p className="mt-2 text-sm leading-6">{String(job.errorMessage)}</p>
              </div>
            </div>
          </section>
        ) : null}

        <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 marker:content-none">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Wrench className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t.technical}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{t.technicalNote}</p>
              </div>
            </div>
            <span className="text-xl text-slate-400 transition group-open:rotate-45" aria-hidden="true">+</span>
          </summary>
          <div className="border-t border-slate-200 p-5">
            {technicalRows.length ? (
              <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {technicalRows.map((row) => (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={row.label}>
                    <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
                    <dd className="mt-2 break-words text-sm font-semibold text-slate-900">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">{t.emptyMetadata}</p>
            )}
          </div>
        </details>
      </div>
    </DashboardShell>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 py-3 sm:grid-cols-[auto_1fr_auto]">
      <Icon className="size-4 text-slate-400" aria-hidden="true" />
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="col-start-2 text-sm font-bold text-slate-900 sm:col-start-3">{value}</dd>
    </div>
  );
}

function buildResultCopy(job: JobRecord, locale: Locale) {
  const type = String(job.type || "");
  const status = String(job.status || "");
  const processed = Number(job.processedCount || 0);
  const success = Number(job.successCount || 0);
  const failed = Number(job.failedCount || 0);
  const skipped = Number(job.skippedCount || 0);
  const metadata = asRecord(job.metadata);
  const remaining = Number(metadata.remainingCount || 0);
  const savedMatches = Number(metadata.savedMatches || 0);
  const eventsCreated = Number(metadata.eventsCreated || 0);
  const entity = entityName(type, locale);
  const n = (value: number) => formatNumber(value, locale);

  if (status === "RUNNING" || status === "PENDING") {
    return locale === "tr"
      ? { title: "Bu iş hâlâ devam ediyor.", description: processed ? `Şimdiye kadar ${n(processed)} ${entity} kontrol edildi. Sonuç tamamlanınca güncellenecek.` : "Kayıtlar henüz kontrol ediliyor. Sonuç tamamlanınca burada gösterilecek." }
      : { title: "این کار هنوز در حال انجام است.", description: processed ? `تا این لحظه ${n(processed)} ${entity} بررسی شده است. نتیجه پس از پایان به‌روزرسانی می‌شود.` : "سیستم هنوز در حال بررسی رکوردهاست؛ نتیجه پس از پایان اینجا نمایش داده می‌شود." };
  }

  if (status === "FAILED") {
    return locale === "tr"
      ? { title: "Bu çalışma tamamlanamadı.", description: processed ? `${n(processed)} ${entity} kontrol edildi ancak bir sistem hatası nedeniyle iş tamamlanmadı.` : "Kayıtlar güncellenmeden önce bir sistem hatası oluştu. Aşağıdaki hata bilgisini kontrol edin." }
      : { title: "این اجرا کامل نشد.", description: processed ? `${n(processed)} ${entity} بررسی شد، اما یک خطای سیستمی مانع تکمیل کار شد.` : "پیش از به‌روزرسانی رکوردها یک خطای سیستمی رخ داد؛ پیام خطا را در پایین صفحه بررسی کنید." };
  }

  if (status === "CANCELLED") {
    return locale === "tr"
      ? { title: "Bu çalışma iptal edildi.", description: "İş tamamlanmadı ve kalan kayıtlar değiştirilmedi." }
      : { title: "این اجرا لغو شد.", description: "کار کامل نشد و رکوردهای باقی‌مانده تغییری نکردند." };
  }

  if (processed === 0) {
    return locale === "tr"
      ? { title: "İş tamamlandı; değiştirilecek kayıt bulunmadı.", description: "CRM kontrol edildi ancak bu çalışma için uygun veya bekleyen bir kayıt yoktu." }
      : { title: "کار انجام شد؛ موردی برای تغییر پیدا نشد.", description: "CRM بررسی شد، اما برای این کار رکورد مناسب یا در انتظاری وجود نداشت." };
  }

  if (status === "PARTIAL" || failed > 0 || remaining > 0) {
    const remainingText = remaining > 0
      ? (locale === "tr" ? `${n(remaining)} kayıt sonraki çalışmaya kaldı.` : `${n(remaining)} مورد برای اجرای بعدی باقی ماند.`)
      : "";
    return locale === "tr"
      ? { title: `${n(processed)} ${entity} kontrol edildi; işin bir kısmı tamamlandı.`, description: `${n(success)} kayıt hatasız tamamlandı, ${n(failed)} kayıtta hata oluştu. ${remainingText}`.trim() }
      : { title: `${n(processed)} ${entity} بررسی شد؛ بخشی از کار انجام شد.`, description: `${n(success)} مورد بدون خطا انجام شد و ${n(failed)} مورد نیازمند بررسی است. ${remainingText}`.trim() };
  }

  const skippedText = skipped > 0
    ? (locale === "tr" ? `${n(skipped)} kayıt uygun olmadığı için atlandı.` : `${n(skipped)} مورد به‌دلیل نامرتبط بودن کنار گذاشته شد.`)
    : "";

  if (type === "NEW_PROPERTY_MATCHING") {
    return locale === "tr"
      ? { title: `${n(processed)} gayrimenkul kontrol edildi.`, description: `${savedMatches > 0 ? `${n(savedMatches)} müşteri önerisi kaydedildi.` : "Kaydedilecek yeni bir müşteri önerisi bulunmadı."} Hata oluşmadı.` }
      : { title: `${n(processed)} ملک بررسی شد.`, description: `${savedMatches > 0 ? `${n(savedMatches)} پیشنهاد مشتری ذخیره شد.` : "پیشنهاد مشتری تازه‌ای برای ذخیره پیدا نشد."} این اجرا بدون خطا انجام شد.` };
  }

  if (type === "DAILY_MATCHING") {
    return locale === "tr"
      ? { title: `${n(processed)} müşteri kontrol edildi.`, description: `${savedMatches > 0 ? `${n(savedMatches)} gayrimenkul önerisi kaydedildi.` : "Kaydedilecek yeni bir gayrimenkul önerisi bulunmadı."} Hata oluşmadı.` }
      : { title: `${n(processed)} مشتری بررسی شد.`, description: `${savedMatches > 0 ? `${n(savedMatches)} پیشنهاد ملک ذخیره شد.` : "پیشنهاد ملک تازه‌ای برای ذخیره پیدا نشد."} این اجرا بدون خطا انجام شد.` };
  }

  if (type === "PENDING_IMPORT_MATCHING") {
    return locale === "tr"
      ? { title: `${n(processed)} aktarılan kayıt kontrol edildi.`, description: `${n(savedMatches)} müşteri veya gayrimenkul önerisi kaydedildi. ${skippedText}`.trim() }
      : { title: `${n(processed)} رکورد واردشده بررسی شد.`, description: `${n(savedMatches)} پیشنهاد مشتری یا ملک ذخیره شد. ${skippedText}`.trim() };
  }

  if (type === "FOLLOWUP_REMINDER") {
    return locale === "tr"
      ? { title: `${n(processed)} bugünkü takip kontrol edildi.`, description: eventsCreated > 0 ? `Danışmanlar için ${n(eventsCreated)} yeni dahili hatırlatma oluşturuldu.` : "Yeni hatırlatma gerekmedi; daha önce oluşturulan hatırlatmalar tekrarlanmadı." }
      : { title: `${n(processed)} پیگیری امروز بررسی شد.`, description: eventsCreated > 0 ? `${n(eventsCreated)} یادآوری داخلی تازه برای کارشناسان ساخته شد.` : "یادآوری تازه‌ای لازم نبود و یادآوری‌های قبلی تکرار نشدند." };
  }

  if (type === "OVERDUE_FOLLOWUP_CHECK") {
    return locale === "tr"
      ? { title: `${n(processed)} gecikmiş takip kontrol edildi.`, description: `${n(success)} takip “gecikmiş” olarak işaretlendi ve ${n(eventsCreated)} dahili uyarı oluşturuldu.` }
      : { title: `${n(processed)} پیگیری عقب‌افتاده بررسی شد.`, description: `${n(success)} پیگیری به‌عنوان «عقب‌افتاده» علامت‌گذاری و ${n(eventsCreated)} هشدار داخلی ساخته شد.` };
  }

  if (type === "INACTIVE_CUSTOMER_CHECK") {
    return locale === "tr"
      ? { title: `${n(processed)} hareketsiz müşteri kontrol edildi.`, description: `${n(success)} müşteri takip gerektiriyor olarak işaretlendi ve ${n(eventsCreated)} dahili uyarı oluşturuldu.` }
      : { title: `${n(processed)} مشتری بدون فعالیت بررسی شد.`, description: `${n(success)} مشتری به‌عنوان نیازمند پیگیری علامت‌گذاری و ${n(eventsCreated)} هشدار داخلی ساخته شد.` };
  }

  return locale === "tr"
    ? { title: `${n(processed)} ${entity} kontrol edildi.`, description: `${n(success)} kayıt hatasız tamamlandı. ${skippedText}`.trim() }
    : { title: `${n(processed)} ${entity} بررسی شد.`, description: `${n(success)} مورد بدون خطا انجام شد. ${skippedText}`.trim() };
}

function executionSource(job: JobRecord, locale: Locale) {
  const trigger = String(job.triggerType || "");
  const initiatedBy = asRecord(job.initiatedBy);
  const name = String(initiatedBy.name || "").trim();

  if (trigger === "MANUAL") {
    if (name) return locale === "tr" ? `${name} tarafından elle` : `اجرای دستی توسط ${name}`;
    return locale === "tr" ? "Yönetici tarafından elle" : "اجرای دستی توسط ادمین";
  }
  return automationTriggerLabel(trigger, locale);
}

function entityName(type: string, locale: Locale) {
  const labels = locale === "tr" ? {
    DAILY_MATCHING: "müşteri",
    FOLLOWUP_REMINDER: "takip",
    INACTIVE_CUSTOMER_CHECK: "müşteri",
    NEW_PROPERTY_MATCHING: "gayrimenkul",
    OVERDUE_FOLLOWUP_CHECK: "takip",
    PENDING_IMPORT_MATCHING: "aktarılan kayıt",
  } : {
    DAILY_MATCHING: "مشتری",
    FOLLOWUP_REMINDER: "پیگیری",
    INACTIVE_CUSTOMER_CHECK: "مشتری",
    NEW_PROPERTY_MATCHING: "ملک",
    OVERDUE_FOLLOWUP_CHECK: "پیگیری",
    PENDING_IMPORT_MATCHING: "رکورد واردشده",
  };
  return labels[type as keyof typeof labels] || (locale === "tr" ? "kayıt" : "رکورد");
}

function buildTechnicalRows(job: JobRecord, locale: Locale, t: {
  batches: string;
  failed: string;
  metadata: Record<string, string>;
  processed: string;
  runId: string;
  skipped: string;
  success: string;
}) {
  const baseRows = [
    { label: t.runId, value: String(job.runId || "-") },
    { label: t.processed, value: formatNumber(Number(job.processedCount || 0), locale) },
    { label: t.success, value: formatNumber(Number(job.successCount || 0), locale) },
    { label: t.failed, value: formatNumber(Number(job.failedCount || 0), locale) },
    { label: t.skipped, value: formatNumber(Number(job.skippedCount || 0), locale) },
    { label: t.batches, value: formatNumber(Number(job.batchCount || 0), locale) },
  ];
  return [...baseRows, ...metadataToRows(job.metadata, locale, t.metadata)];
}

function resultPanelClass(needsAttention: boolean, isRunning: boolean) {
  if (needsAttention) return "flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950 sm:p-6";
  if (isRunning) return "flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50 p-5 text-blue-950 sm:p-6";
  return "flex items-start gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 sm:p-6";
}

function resultIconClass(needsAttention: boolean, isRunning: boolean) {
  if (needsAttention) return "flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm";
  if (isRunning) return "flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm";
  return "flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm";
}

function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn").format(value);
}

function toneForStatus(status: string) {
  if (status === "SUCCESS") return "emerald";
  if (status === "FAILED") return "red";
  if (status === "PARTIAL" || status === "RUNNING") return "amber";
  return "slate";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metadataToRows(metadata: unknown, locale: Locale, labels: Record<string, string>) {
  const record = asRecord(metadata);
  return Object.entries(record)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({
      label: labels[key] || key,
      value: formatMetadataValue(value, locale),
    }));
}

function formatMetadataValue(value: unknown, locale: Locale): string {
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
