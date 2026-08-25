import type { AppLocale } from "@/lib/i18n";

const jobLabels = {
  DAILY_MATCHING: {
    fa: [
      "به‌روزرسانی پیشنهادهای مشتریان",
      "مشتریانی که اطلاعات یا پیشنهادهایشان تغییر کرده دوباره بررسی می‌شوند.",
      "پیشنهادهای ملک برای این مشتریان دوباره محاسبه می‌شود؛ موارد نامعتبر کنار می‌روند و پیشنهادهای مناسب ذخیره می‌شوند.",
    ],
    tr: [
      "Müşteri önerilerini güncelle",
      "Bilgileri veya önerileri değişen müşteriler yeniden kontrol edilir.",
      "Bu müşterilerin gayrimenkul önerileri yeniden hesaplanır; geçersiz öneriler kaldırılır ve uygun olanlar kaydedilir.",
    ],
  },
  FOLLOWUP_REMINDER: {
    fa: [
      "یادآوری پیگیری‌های امروز",
      "پیگیری‌هایی که باید امروز انجام شوند پیدا می‌شوند.",
      "برای هر پیگیری امروز، یک یادآوری داخلی برای کارشناس مسئول ساخته می‌شود. وضعیت پیگیری تغییر نمی‌کند.",
    ],
    tr: [
      "Bugünkü takipleri hatırlat",
      "Bugün yapılması gereken takipler bulunur.",
      "Her takip için sorumlu danışmana dahili bir hatırlatma oluşturulur. Takibin durumu değişmez.",
    ],
  },
  INACTIVE_CUSTOMER_CHECK: {
    fa: [
      "پیدا کردن مشتریان بدون فعالیت",
      "مشتریان فعالی که مدتی تماس یا فعالیت نداشته‌اند پیدا می‌شوند.",
      "برای کارشناس مسئول هشدار داخلی ساخته و مشتری به‌عنوان نیازمند پیگیری علامت‌گذاری می‌شود.",
    ],
    tr: [
      "Hareketsiz müşterileri bul",
      "Bir süredir iletişim veya aktivitesi olmayan etkin müşteriler bulunur.",
      "Sorumlu danışmana dahili uyarı oluşturulur ve müşteri takip gerektiriyor olarak işaretlenir.",
    ],
  },
  NEW_PROPERTY_MATCHING: {
    fa: [
      "پیدا کردن مشتری برای ملک‌های جدید",
      "ملک‌های فعالی که هنوز پیشنهاد مشتری ندارند بررسی می‌شوند.",
      "برای هر ملک، مشتریان مناسب دوباره محاسبه می‌شوند و پیشنهادهای قدیمی یا نامعتبر به‌روزرسانی می‌شوند.",
    ],
    tr: [
      "Yeni gayrimenkullere müşteri bul",
      "Henüz müşteri önerisi olmayan etkin gayrimenkuller kontrol edilir.",
      "Her gayrimenkul için uygun müşteriler yeniden hesaplanır; eski veya geçersiz öneriler güncellenir.",
    ],
  },
  OVERDUE_FOLLOWUP_CHECK: {
    fa: [
      "علامت‌گذاری پیگیری‌های عقب‌افتاده",
      "پیگیری‌هایی که زمانشان گذشته اما هنوز انجام نشده‌اند پیدا می‌شوند.",
      "وضعیت این پیگیری‌ها به «عقب‌افتاده» تغییر می‌کند و برای کارشناس مسئول هشدار داخلی ساخته می‌شود.",
    ],
    tr: [
      "Geciken takipleri işaretle",
      "Zamanı geçmiş ancak tamamlanmamış takipler bulunur.",
      "Bu takiplerin durumu “gecikmiş” olarak değiştirilir ve sorumlu danışmana dahili uyarı oluşturulur.",
    ],
  },
  PENDING_IMPORT_MATCHING: {
    fa: [
      "ساخت پیشنهاد برای اطلاعات واردشده",
      "مشتری‌ها و ملک‌هایی که با فایل وارد شده‌اند و هنوز بررسی نشده‌اند پیدا می‌شوند.",
      "برای رکوردهای واردشده، پیشنهادهای مشتری و ملک محاسبه و نتیجه در CRM ذخیره می‌شود.",
    ],
    tr: [
      "Aktarılan veriler için öneri oluştur",
      "Dosyayla aktarılan ve henüz kontrol edilmemiş müşteri ve gayrimenkuller bulunur.",
      "Aktarılan kayıtlar için müşteri ve gayrimenkul önerileri hesaplanır ve CRM'e kaydedilir.",
    ],
  },
} as const;

const jobSchedules = {
  DAILY_MATCHING: { fa: "هر روز ساعت ۰۳:۰۰", tr: "Her gün 03:00" },
  FOLLOWUP_REMINDER: { fa: "هر روز ساعت ۰۹:۰۰", tr: "Her gün 09:00" },
  INACTIVE_CUSTOMER_CHECK: { fa: "هر روز ساعت ۰۴:۳۰", tr: "Her gün 04:30" },
  NEW_PROPERTY_MATCHING: { fa: "هر روز ساعت ۰۳:۳۰", tr: "Her gün 03:30" },
  OVERDUE_FOLLOWUP_CHECK: { fa: "هر روز ساعت ۰۹:۰۵", tr: "Her gün 09:05" },
  PENDING_IMPORT_MATCHING: { fa: "هر ۶ ساعت", tr: "Her 6 saatte bir" },
} as const;

export function automationJobText(type: string, locale: AppLocale, fallbackName = "", fallbackDescription = "") {
  const entry = jobLabels[type as keyof typeof jobLabels];
  const values = entry?.[locale];
  return {
    description: values?.[1] || fallbackDescription,
    name: values?.[0] || fallbackName || type,
  };
}

export function automationJobEffect(type: string, locale: AppLocale) {
  const entry = jobLabels[type as keyof typeof jobLabels];
  return entry?.[locale]?.[2] || (locale === "tr" ? "Uygun kayıtlar kontrol edilir ve CRM güncellenir." : "رکوردهای مرتبط بررسی و نتیجه در CRM به‌روزرسانی می‌شود.");
}

export function automationScheduleLabel(type: string, locale: AppLocale, fallback = "") {
  const entry = jobSchedules[type as keyof typeof jobSchedules];
  const schedule = entry?.[locale] || fallback || "-";
  return locale === "tr" ? `${schedule} (İstanbul saati)` : `${schedule} به وقت استانبول`;
}

export function automationStatusLabel(status: string, locale: AppLocale) {
  const labels = locale === "tr" ? {
    CANCELLED: "İptal edildi", FAILED: "Tamamlanamadı", PARTIAL: "Bir kısmı tamamlandı", PENDING: "Sırada", RUNNING: "Devam ediyor", SUCCESS: "Tamamlandı",
  } : {
    CANCELLED: "لغو شد", FAILED: "انجام نشد", PARTIAL: "بخشی انجام شد", PENDING: "در صف اجرا", RUNNING: "در حال انجام", SUCCESS: "انجام شد",
  };
  return labels[status as keyof typeof labels] || status;
}

export function automationTriggerLabel(trigger: string, locale: AppLocale) {
  const labels = locale === "tr"
    ? { CRON: "Otomatik", MANUAL: "Elle çalıştırıldı", SYSTEM: "Sistem tarafından" }
    : { CRON: "خودکار", MANUAL: "اجرای دستی", SYSTEM: "توسط سیستم" };
  return labels[trigger as keyof typeof labels] || trigger;
}

export function automationHealthLabel(health: string, locale: AppLocale) {
  const labels = locale === "tr"
    ? { Error: "Sistem hatası", Healthy: "Her şey yolunda", Warning: "Kontrol gerekli" }
    : { Error: "خطای سیستم", Healthy: "همه‌چیز مرتب است", Warning: "نیاز به بررسی" };
  return labels[health as keyof typeof labels] || health;
}

export function automationDuration(ms: number, locale: AppLocale) {
  if (!ms) return "-";
  const value = ms < 1000 ? ms : Math.round(ms / 1000);
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn").format(value);
  if (ms < 1000) return `${formatted} ${locale === "tr" ? "milisaniye" : "میلی‌ثانیه"}`;
  return `${formatted} ${locale === "tr" ? "saniye" : "ثانیه"}`;
}
