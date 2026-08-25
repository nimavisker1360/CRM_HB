"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Play, ShieldCheck, X } from "lucide-react";
import type { AutomationJobType } from "@/services/automation/automation.types";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { automationStatusLabel } from "@/lib/automation-i18n";

type AutomationRunButtonProps = {
  effect?: string;
  heavy?: boolean;
  label?: string;
  name?: string;
  type: AutomationJobType;
};

export function AutomationRunButton({ effect, heavy, label, name, type }: AutomationRunButtonProps) {
  const { locale } = useLanguage();
  const t = locale === "tr" ? {
    cancel: "Vazgeç", confirmRun: "Evet, şimdi çalıştır", confirmTitle: "Bu işi şimdi çalıştırmak istiyor musunuz?",
    failed: "İş çalıştırılamadı.", heavyNote: "Kayıt sayısı fazlaysa işlem biraz sürebilir.",
    impact: "Çalıştırınca ne olacak?", processed: "kayıt kontrol edildi", run: "Elle çalıştır", running: "Çalıştırılıyor...",
    safeNote: "Müşteri ve gayrimenkul kayıtları silinmez; yalnızca yukarıda açıklanan sonuçlar güncellenir.",
  } : {
    cancel: "انصراف", confirmRun: "بله، همین حالا اجرا شود", confirmTitle: "این کار همین حالا اجرا شود؟",
    failed: "این کار اجرا نشد؛ دوباره تلاش کنید.", heavyNote: "اگر تعداد رکوردها زیاد باشد، انجام این کار کمی زمان می‌برد.",
    impact: "بعد از اجرا چه می‌شود؟", processed: "مورد بررسی شد", run: "اجرای دستی", running: "در حال اجرا...",
    safeNote: "اطلاعات مشتری و ملک حذف نمی‌شود؛ فقط نتیجه‌هایی که بالا توضیح داده شده به‌روزرسانی می‌شوند.",
  };
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setIsConfirming(false);
    setIsRunning(true);
    setMessage("");

    try {
      const response = await fetch("/api/automation/run", {
        body: JSON.stringify({ type }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(t.failed);
        return;
      }
      setMessage(`${automationStatusLabel(String(result.data.status), locale)}: ${result.data.processed} ${t.processed}`);
      router.refresh();
    } catch {
      setMessage(t.failed);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isRunning}
        onClick={() => setIsConfirming(true)}
        type="button"
      >
        <Play className="size-4" aria-hidden="true" />
        {isRunning ? t.running : label || t.run}
      </button>
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
      {isConfirming ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="presentation">
          <div
            aria-labelledby={`automation-confirm-${type}`}
            aria-modal="true"
            className="w-full max-w-lg rounded-xl bg-white p-5 text-start shadow-2xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-blue-700">{name}</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950" id={`automation-confirm-${type}`}>{t.confirmTitle}</h2>
              </div>
              <button
                aria-label={t.cancel}
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100"
                onClick={() => setIsConfirming(false)}
                type="button"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-blue-950">
                <Info className="size-4" aria-hidden="true" />
                {t.impact}
              </div>
              <p className="mt-2 text-sm leading-6 text-blue-900">{effect}</p>
            </div>

            <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-600">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <p>{t.safeNote}{heavy ? ` ${t.heavyNote}` : ""}</p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={() => setIsConfirming(false)}
                type="button"
              >
                {t.cancel}
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => void run()}
                type="button"
              >
                <Play className="size-4" aria-hidden="true" />
                {t.confirmRun}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
