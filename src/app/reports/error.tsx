"use client";

import { useEffect } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function ReportsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useLanguage();
  const t = locale === "tr"
    ? { description: "Veritabanı bağlantısını veya rapor sorgularını denetleyip tekrar deneyin.", retry: "Tekrar dene", title: "Rapor alınırken bir hata oluştu." }
    : { description: "اتصال پایگاه داده یا تجمیع‌های گزارش را بررسی کنید و دوباره تلاش کنید.", retry: "تلاش دوباره", title: "دریافت گزارش با خطا مواجه شد." };
  useEffect(() => { console.error("[reports]", error); }, [error]);
  return (
    <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-6 text-red-950" role="alert">
      <h2 className="font-semibold">{t.title}</h2>
      <p className="mt-1 text-sm text-red-800">{t.description}</p>
      <button className="mt-4 rounded-md bg-red-900 px-4 py-2 text-sm font-medium text-white" onClick={reset} type="button">{t.retry}</button>
    </div>
  );
}
