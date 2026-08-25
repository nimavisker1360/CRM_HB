"use client";

import Link from "next/link";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { WhatsAppComposer, type WhatsAppMatchOption, type WhatsAppPropertyOption } from "@/components/whatsapp/WhatsAppComposer";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { translateLiteral } from "@/lib/i18n";

type Message = {
  _id: string;
  agentId?: { fullName?: string; name?: string };
  createdAt?: string;
  direction?: string;
  messageType?: string;
  status?: string;
  text?: string;
};

const statusStyle: Record<string, string> = {
  DELIVERED: "bg-blue-100 text-blue-700",
  FAILED: "bg-red-100 text-red-700",
  READ: "bg-violet-100 text-violet-700",
  SENT: "bg-emerald-100 text-emerald-700",
};

export function CustomerWhatsAppPanel(props: {
  agent?: { fullName?: string; name?: string };
  customer: { fullName: string; id: string; phone?: string; whatsapp?: string };
  matches: WhatsAppMatchOption[];
  properties: WhatsAppPropertyOption[];
}) {
  const { locale } = useLanguage();
  const t = locale === "tr" ? {
    actions: "İşlemler", confirmDelete: "Bu mesaj kalıcı olarak veritabanından silinsin mi? Bu işlem geri alınamaz.", delete: "Sil",
    deleteError: "Mesaj silinemedi.", deleting: "Siliniyor...",
    agent: "Danışman", date: "Tarih", empty: "Henüz WhatsApp mesajı kaydedilmedi.",
    history: "WhatsApp geçmişi", loading: "Geçmiş yükleniyor...", message: "Mesaj",
    note: "Meta test numarası mesajları; yalnızca izinli test alıcısına gönderilir.",
    status: "Durum", testMode: "TEST MODU", type: "Tür",
  } : {
    actions: "عملیات", confirmDelete: "این پیام برای همیشه از دیتابیس حذف شود؟ این عملیات قابل بازگشت نیست.", delete: "حذف",
    deleteError: "حذف پیام ناموفق بود.", deleting: "در حال حذف...",
    agent: "مشاور", date: "تاریخ", empty: "هنوز پیام واتساپی ثبت نشده است.",
    history: "تاریخچه واتساپ", loading: "در حال دریافت تاریخچه...", message: "پیام",
    note: "پیام‌های شماره آزمایشی متا؛ ارسال فقط برای گیرنده مجاز آزمایشی انجام می‌شود.",
    status: "وضعیت", testMode: "حالت آزمایشی", type: "نوع",
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/whatsapp/messages?customerId=${encodeURIComponent(props.customer.id)}&limit=20`);
      const result = await response.json();
      if (result.success) setMessages(result.data.items || []);
    } finally {
      setLoading(false);
    }
  }, [props.customer.id]);

  useEffect(() => {
    let active = true;
    fetch(`/api/whatsapp/messages?customerId=${encodeURIComponent(props.customer.id)}&limit=20`)
      .then((response) => response.json())
      .then((result) => {
        if (active && result.success) setMessages(result.data.items || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [props.customer.id]);

  async function deleteMessage(messageId: string) {
    if (!window.confirm(t.confirmDelete)) return;

    setDeletingId(messageId);
    setDeleteError("");
    try {
      const response = await fetch(`/api/whatsapp/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: { message?: string }; success: boolean };
      if (!response.ok || !result.success) {
        setDeleteError(result.error?.message || t.deleteError);
        return;
      }
      setMessages((current) => current.filter((message) => message._id !== messageId));
    } catch {
      setDeleteError(t.deleteError);
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="app-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-slate-950">{t.history}</h2>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{t.testMode}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{t.note}</p>
        </div>
        <WhatsAppComposer {...props} includeActivePropertyCatalog onSent={load} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-right text-sm">
          <thead className="border-b border-slate-200 text-xs text-slate-500">
            <tr><th className="p-3">{t.date}</th><th className="p-3">{t.type}</th><th className="p-3">{t.message}</th><th className="p-3">{t.agent}</th><th className="p-3">{t.status}</th><th className="p-3">{t.actions}</th></tr>
          </thead>
          <tbody>
            {messages.map((message) => (
              <tr className="border-b border-slate-100" key={message._id}>
                <td className="p-3 text-slate-500">{message.createdAt ? new Date(message.createdAt).toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR") : "-"}</td>
                <td className="p-3">{translateLiteral(message.direction === "INBOUND" ? message.direction : message.messageType || "", locale)}</td>
                <td className="max-w-sm truncate p-3"><Link className="hover:underline" href={`/whatsapp/${message._id}`}>{message.text || "-"}</Link></td>
                <td className="p-3">{message.agentId?.fullName || message.agentId?.name || "-"}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyle[message.status || ""] || "bg-slate-100 text-slate-700"}`}>{translateLiteral(message.status || "", locale)}</span></td>
                <td className="p-3">
                  <button
                    aria-label={deletingId === message._id ? t.deleting : t.delete}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-red-200 px-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(deletingId)}
                    onClick={() => void deleteMessage(message._id)}
                    title={t.delete}
                    type="button"
                  >
                    {deletingId === message._id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    <span>{deletingId === message._id ? t.deleting : t.delete}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!messages.length && !loading ? <p className="p-4 text-sm text-slate-500">{t.empty}</p> : null}
        {loading ? <p className="p-4 text-sm text-slate-500">{t.loading}</p> : null}
        {deleteError ? <p className="p-4 text-sm text-red-600" role="alert">{deleteError}</p> : null}
      </div>
    </section>
  );
}
