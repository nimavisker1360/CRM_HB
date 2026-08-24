import type { AppLocale } from "@/lib/i18n";

function numberLocale(locale?: AppLocale) {
  return locale === "tr" ? "tr-TR" : locale === "fa" ? "fa-IR-u-nu-latn" : "en-US";
}

export function compactNumber(value: number, locale?: AppLocale) {
  return new Intl.NumberFormat(numberLocale(locale), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function currency(value?: number, code = "USD", locale?: AppLocale) {
  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat(numberLocale(locale), {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

export function formatPercent(value: number) {
  return `${formatNumber(value, 1)}%`;
}

export function formatCurrency(value: number, code: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "code",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${formatNumber(value)} ${code}`;
  }
}

export const CRM_DATE_LOCALE = "fa-IR-u-ca-gregory-nu-latn";
export const CRM_TIME_ZONE = "Europe/Istanbul";

export function formatGregorianDate(value: unknown, locale?: AppLocale) {
  return formatCrmDate(value, { dateStyle: "medium" }, locale);
}

export function formatGregorianDateTime(value: unknown, locale?: AppLocale) {
  return formatCrmDate(value, { dateStyle: "medium", timeStyle: "short" }, locale);
}

export function formatGregorianTime(value: unknown, locale?: AppLocale) {
  return formatCrmDate(value, { hour: "2-digit", minute: "2-digit" }, locale);
}

function formatCrmDate(value: unknown, options: Intl.DateTimeFormatOptions, locale?: AppLocale) {
  if (value === undefined || value === null || value === "") return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  const resolvedLocale = locale === "tr" ? "tr-TR" : locale === "fa" ? CRM_DATE_LOCALE : CRM_DATE_LOCALE;
  return new Intl.DateTimeFormat(resolvedLocale, { ...options, timeZone: CRM_TIME_ZONE }).format(date);
}
