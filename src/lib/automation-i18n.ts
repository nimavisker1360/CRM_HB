import type { AppLocale } from "@/lib/i18n";

const jobLabels = {
  DAILY_MATCHING: { fa: ["تطبیق روزانه مشتری‌ها", "محاسبه دوباره تطبیق مشتری‌هایی که وضعیت تطبیق آن‌ها در انتظار یا قدیمی است."], tr: ["Günlük müşteri eşleştirmesi", "Bekleyen veya eski eşleşme durumuna sahip müşterilerin eşleşmelerini yeniden hesaplar."] },
  FOLLOWUP_REMINDER: { fa: ["یادآور پیگیری امروز", "آماده‌سازی یادآور داخلی برای پیگیری‌های امروز بر اساس زمان استانبول."], tr: ["Bugünün takip hatırlatıcısı", "İstanbul saatine göre bugünkü takipler için dahili hatırlatıcılar hazırlar."] },
  INACTIVE_CUSTOMER_CHECK: { fa: ["بررسی مشتری‌های غیرفعال", "شناسایی مشتری‌های فعال که اخیراً فعالیتی نداشته‌اند."], tr: ["Etkin olmayan müşterileri denetle", "Yakın zamanda aktivitesi olmayan etkin müşterileri belirler."] },
  NEW_PROPERTY_MATCHING: { fa: ["تطبیق ملک‌های جدید", "پیدا کردن مشتری‌های مناسب برای ملک‌های فعال با وضعیت تطبیق در انتظار."], tr: ["Yeni gayrimenkul eşleştirmesi", "Eşleşme bekleyen etkin gayrimenkuller için uygun müşterileri bulur."] },
  OVERDUE_FOLLOWUP_CHECK: { fa: ["بررسی پیگیری‌های عقب‌افتاده", "شناسایی پیگیری‌های عقب‌افتاده و آماده‌سازی هشدار داخلی."], tr: ["Gecikmiş takipleri denetle", "Gecikmiş takipleri belirler ve dahili uyarılar hazırlar."] },
  PENDING_IMPORT_MATCHING: { fa: ["تطبیق داده‌های واردشده", "پردازش رکوردهای واردشده مشتری و ملک که منتظر تطبیق هستند."], tr: ["Aktarılan verileri eşleştir", "Eşleşme bekleyen aktarılmış müşteri ve gayrimenkul kayıtlarını işler."] },
} as const;

export function automationJobText(type: string, locale: AppLocale, fallbackName = "", fallbackDescription = "") {
  const entry = jobLabels[type as keyof typeof jobLabels];
  const values = entry?.[locale];
  return {
    description: values?.[1] || fallbackDescription,
    name: values?.[0] || fallbackName || type,
  };
}

export function automationStatusLabel(status: string, locale: AppLocale) {
  const labels = locale === "tr" ? {
    CANCELLED: "İptal edildi", FAILED: "Başarısız", PARTIAL: "Kısmen tamamlandı", PENDING: "Bekliyor", RUNNING: "Çalışıyor", SUCCESS: "Başarılı",
  } : {
    CANCELLED: "لغوشده", FAILED: "ناموفق", PARTIAL: "نیمه‌کامل", PENDING: "در انتظار", RUNNING: "در حال اجرا", SUCCESS: "موفق",
  };
  return labels[status as keyof typeof labels] || status;
}

export function automationTriggerLabel(trigger: string, locale: AppLocale) {
  const labels = locale === "tr"
    ? { CRON: "Zamanlanmış", MANUAL: "Manuel", SYSTEM: "Sistem" }
    : { CRON: "زمان‌بندی‌شده", MANUAL: "دستی", SYSTEM: "سیستمی" };
  return labels[trigger as keyof typeof labels] || trigger;
}

export function automationHealthLabel(health: string, locale: AppLocale) {
  const labels = locale === "tr"
    ? { Error: "Hata", Healthy: "Sağlıklı", Warning: "Uyarı" }
    : { Error: "خطا", Healthy: "سالم", Warning: "هشدار" };
  return labels[health as keyof typeof labels] || health;
}

export function automationDuration(ms: number, locale: AppLocale) {
  if (!ms) return "-";
  const value = ms < 1000 ? ms : Math.round(ms / 1000);
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn").format(value);
  if (ms < 1000) return `${formatted} ${locale === "tr" ? "milisaniye" : "میلی‌ثانیه"}`;
  return `${formatted} ${locale === "tr" ? "saniye" : "ثانیه"}`;
}
