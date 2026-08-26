"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { CRM_NOTIFICATIONS_CHANGED_EVENT } from "@/components/layout/RealtimeBridge";

export function NotificationDeleteButton({ agentId, notificationId }: { agentId?: string; notificationId: string }) {
  const { locale } = useLanguage();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = locale === "tr"
    ? {
        confirm: "Bu bildirim kalıcı olarak silinsin mi? Bu işlem geri alınamaz.",
        delete: "Sil",
        deleting: "Siliniyor...",
        failed: "Bildirim silinemedi.",
      }
    : {
        confirm: "این اعلان برای همیشه پاک شود؟ این عملیات قابل بازگشت نیست.",
        delete: "حذف",
        deleting: "در حال حذف...",
        failed: "اعلان حذف نشد.",
      };

  async function deleteNotification() {
    if (!window.confirm(t.confirm)) return;

    setDeleting(true);
    setFailed(false);

    try {
      const params = new URLSearchParams();
      if (agentId) params.set("agentId", agentId);
      const response = await fetch(
        `/api/notifications/${encodeURIComponent(notificationId)}${params.size ? `?${params.toString()}` : ""}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as { success?: boolean };

      if (!response.ok || !result.success) {
        setFailed(true);
        return;
      }

      window.dispatchEvent(new Event(CRM_NOTIFICATIONS_CHANGED_EVENT));
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
        className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={deleting}
        onClick={() => void deleteNotification()}
        title={t.delete}
        type="button"
      >
        {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        {deleting ? t.deleting : t.delete}
      </button>
      {failed ? <span className="text-xs text-red-600" role="alert">{t.failed}</span> : null}
    </div>
  );
}
