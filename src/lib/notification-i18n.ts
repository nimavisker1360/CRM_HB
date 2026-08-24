import type { AppLocale } from "@/lib/i18n";
import { translateLiteral } from "@/lib/i18n";

const titleTranslations: Record<string, string> = {
  "تطبیق جدید": "Yeni eşleşme",
  "پیگیری جدید برای شما ثبت شد": "Sizin için yeni bir takip oluşturuldu",
  "پیگیری امروز": "Bugünkü takip",
  "پیگیری عقب‌افتاده": "Gecikmiş takip",
  "مشتری جدید به شما اختصاص داده شد": "Size yeni bir müşteri atandı",
  "یک مشتری جدید به شما منتقل شد": "Size yeni bir müşteri aktarıldı",
  "مشتری از پنل شما منتقل شد": "Müşteri panelinizden aktarıldı",
};

export function localizeNotificationText(value: string, locale: AppLocale) {
  if (locale === "fa" || !value) return value;
  if (titleTranslations[value]) return titleTranslations[value];

  let match = value.match(/^برای (.+) ملک (.+) با تطبیق (.+)% پیدا شد\.$/);
  if (match) return `${match[1]} için ${match[2]} gayrimenkulü %${match[3]} eşleşme oranıyla bulundu.`;

  match = value.match(/^پیگیری جدید(?: برای ساعت (.+))? برای (.+) به شما اختصاص داده شد\.$/);
  if (match) return `${match[2]} için yeni bir takip${match[1] ? ` saat ${match[1]}` : ""} size atandı.`;

  match = value.match(/^امروز(?: ساعت (.+))? باید با (.+) تماس بگیرید\.$/);
  if (match) return `Bugün${match[1] ? ` saat ${match[1]}` : ""} ${match[2]} ile iletişime geçmelisiniz.`;

  match = value.match(/^پیگیری مشتری (.+) هنوز انجام نشده است\.$/);
  if (match) return `${match[1]} adlı müşterinin takibi henüz tamamlanmadı.`;

  match = value.match(/^مشتری (.+) به شما اختصاص داده شد\.$/);
  if (match) return `${match[1]} adlı müşteri size atandı.`;

  match = value.match(/^مشتری (.+) به پنل شما منتقل شد\.$/);
  if (match) return `${match[1]} adlı müşteri panelinize aktarıldı.`;

  match = value.match(/^مشتری (.+) از پنل شما منتقل شد\.$/);
  if (match) return `${match[1]} adlı müşteri panelinizden aktarıldı.`;

  return translateLiteral(value, locale);
}
