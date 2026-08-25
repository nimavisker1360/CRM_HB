"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function WhatsAppMessageDeleteButton({ messageId }: { messageId: string }) {
  const { locale } = useLanguage();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = locale === "tr"
    ? {
        confirm: "Bu mesaj kaydı kalıcı olarak veritabanından silinsin mi? Bu işlem geri alınamaz.",
        delete: "Sil",
        deleting: "Siliniyor...",
        failed: "Silinemedi",
      }
    : {
        confirm: "این پیام برای همیشه از دیتابیس پاک شود؟ این عملیات قابل بازگشت نیست.",
        delete: "پاک کردن",
        deleting: "در حال پاک کردن...",
        failed: "پاک نشد",
      };

  async function deleteMessage() {
    if (!window.confirm(t.confirm)) return;

    setDeleting(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/whatsapp/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
      const result = (await response.json()) as { success?: boolean };
      if (!response.ok || !result.success) {
        setFailed(true);
        return;
      }
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        aria-label={deleting ? t.deleting : t.delete}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 px-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={deleting}
        onClick={() => void deleteMessage()}
        title={t.delete}
        type="button"
      >
        {deleting ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        <span>{deleting ? t.deleting : t.delete}</span>
      </button>
      {failed ? <span className="text-xs text-red-600" role="alert">{t.failed}</span> : null}
    </div>
  );
}
