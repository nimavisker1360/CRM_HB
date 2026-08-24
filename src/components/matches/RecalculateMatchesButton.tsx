"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type RecalculateMatchesButtonProps = (
  | { customerId: string; propertyId?: never }
  | { customerId?: never; propertyId: string }
) & { label?: string };

export function RecalculateMatchesButton(props: RecalculateMatchesButtonProps) {
  const router = useRouter();
  const { locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function recalculate() {
    setLoading(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/matches/recalculate", {
      body: JSON.stringify(props),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json()) as {
      data?: { saved: number; scanned: number };
      error?: { message?: string };
      success: boolean;
    };
    setLoading(false);

    if (!result.success || !result.data) {
      setError(locale === "tr" ? "Eşleşmeler hesaplanamadı." : result.error?.message || "محاسبه تطبیق‌ها انجام نشد.");
      return;
    }

    setMessage(locale === "tr"
      ? `${result.data.scanned} adaydan ${result.data.saved} eşleşme kaydedildi.`
      : `از میان ${result.data.scanned} گزینه، ${result.data.saved} تطبیق ذخیره شد.`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        disabled={loading}
        onClick={() => void recalculate()}
        type="button"
      >
        <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
        {props.label || (locale === "tr" ? "Eşleşmeleri hesapla" : "محاسبه دوباره تطبیق‌ها")}
      </button>
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
