"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, MailCheck, MessageCircle, Send, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { MatchStatus } from "@/services/matching/matching.types";

const actions = [
  { icon: Eye, label: "مشاهده‌شده", status: "VIEWED", trLabel: "Görüntülendi" },
  { icon: Send, label: "ارسال‌شده", status: "SENT", trLabel: "Gönderildi" },
  { icon: CheckCircle2, label: "علاقه‌مند", status: "INTERESTED", trLabel: "İlgileniyor" },
  { icon: XCircle, label: "ردشده", status: "REJECTED", trLabel: "Reddedildi" },
  { icon: MessageCircle, label: "جلسه", status: "MEETING", trLabel: "Görüşme" },
] as const;

type Props = {
  canDelete?: boolean;
  currentStatus: MatchStatus;
  matchId: string;
};

export function MatchStatusActions({ canDelete = false, currentStatus, matchId }: Props) {
  const router = useRouter();
  const { locale } = useLanguage();
  const [activeStatus, setActiveStatus] = useState<MatchStatus>(currentStatus);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function updateStatus(status: MatchStatus) {
    setLoadingStatus(status);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const result = (await response.json()) as { error?: { code?: string; message?: string }; success: boolean };

      if (!response.ok || !result.success) {
        setError(result.error?.code === "INVALID_TRANSITION"
          ? locale === "tr" ? "Bu durum değişikliğine izin verilmiyor." : "این تغییر وضعیت مجاز نیست."
          : locale === "tr" ? "Durum değiştirilemedi." : result.error?.message || "تغییر وضعیت ناموفق بود.");
        return;
      }

      const selected = actions.find((action) => action.status === status);
      setActiveStatus(status);
      setMessage(locale === "tr"
        ? `Durum “${selected?.trLabel || status}” olarak güncellendi.`
        : `وضعیت با موفقیت به «${selected?.label || status}» تغییر کرد.`);
      router.refresh();
    } catch {
      setError(locale === "tr" ? "Sunucuya bağlanılamadı." : "ارتباط با سرور برقرار نشد.");
    } finally {
      setLoadingStatus("");
    }
  }

  async function deleteMatch() {
    if (!window.confirm(locale === "tr" ? "Bu eşleşme silinsin mi?" : "این تطبیق حذف شود؟")) return;
    setLoadingStatus("DELETE");
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: { message?: string }; success: boolean };
      if (!response.ok || !result.success) {
        setError(locale === "tr" ? "Silme işlemi başarısız oldu." : result.error?.message || "حذف ناموفق بود.");
        return;
      }
      router.refresh();
    } catch {
      setError(locale === "tr" ? "Sunucuya bağlanılamadı." : "ارتباط با سرور برقرار نشد.");
    } finally {
      setLoadingStatus("");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {actions.map((action) => {
          const Icon = action.icon;
          const isActive = activeStatus === action.status;
          return (
            <button
              aria-pressed={isActive}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition disabled:opacity-50 ${isActive ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100" : "border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"}`}
              disabled={Boolean(loadingStatus)}
              key={action.status}
              onClick={() => void updateStatus(action.status)}
              title={locale === "tr" ? action.trLabel : action.label}
              type="button"
            >
              {loadingStatus === action.status ? <MailCheck className="size-4 animate-pulse" /> : <Icon className="size-4" />}
              <span>{locale === "tr" ? action.trLabel : action.label}</span>
            </button>
          );
        })}
        {canDelete ? (
          <button
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-red-200 px-2.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            disabled={Boolean(loadingStatus)}
            onClick={() => void deleteMatch()}
            title={locale === "tr" ? "Sil" : "حذف"}
            type="button"
          >
            {loadingStatus === "DELETE" ? <MailCheck className="size-4 animate-pulse" /> : <Trash2 className="size-4" />}
            <span>{locale === "tr" ? "Sil" : "حذف"}</span>
          </button>
        ) : null}
      </div>
      {message ? <p className="text-xs font-medium text-emerald-700" role="status">{message}</p> : null}
      {error ? <p className="text-xs text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
