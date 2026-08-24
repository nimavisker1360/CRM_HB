"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type ApiResponse = {
  success: boolean;
  error?: { message?: string };
};

export function FollowUpStatusAction({ followUpId, status }: { followUpId: string; status: string }) {
  const router = useRouter();
  const { locale } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (["COMPLETED", "DONE", "CANCELLED", "CANCELED"].includes(status)) return null;

  async function completeFollowUp() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/follow-ups/${followUpId}`, {
        body: JSON.stringify({ status: "COMPLETED" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.success) {
        setError(locale === "tr" ? "Takip durumu kaydedilemedi." : result.error?.message || "ثبت وضعیت پیگیری انجام نشد.");
        return;
      }
      router.refresh();
    } catch {
      setError(locale === "tr" ? "Sunucuyla bağlantı kurulamadı." : "ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
        disabled={loading}
        onClick={completeFollowUp}
        type="button"
      >
        <CheckCircle2 className="size-4" />
        {loading ? (locale === "tr" ? "Kaydediliyor..." : "در حال ثبت...") : (locale === "tr" ? "Tamamlandı" : "انجام شد")}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
