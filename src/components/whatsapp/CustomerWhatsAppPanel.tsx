"use client";

import Link from "next/link";
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
    agent: "Danışman", date: "Tarih", empty: "Henüz WhatsApp mesajı kaydedilmedi.",
    history: "WhatsApp geçmişi", loading: "Geçmiş yükleniyor...", message: "Mesaj",
    note: "Meta test numarası mesajları; yalnızca izinli test alıcısına gönderilir.",
    status: "Durum", testMode: "TEST MODU", type: "Tür",
  } : {
    agent: "مشاور", date: "تاریخ", empty: "هنوز پیام واتساپی ثبت نشده است.",
    history: "تاریخچه واتساپ", loading: "در حال دریافت تاریخچه...", message: "پیام",
    note: "پیام‌های شماره آزمایشی متا؛ ارسال فقط برای گیرنده مجاز آزمایشی انجام می‌شود.",
    status: "وضعیت", testMode: "حالت آزمایشی", type: "نوع",
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

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
        <table className="w-full min-w-[680px] text-right text-sm">
          <thead className="border-b border-slate-200 text-xs text-slate-500">
            <tr><th className="p-3">{t.date}</th><th className="p-3">{t.type}</th><th className="p-3">{t.message}</th><th className="p-3">{t.agent}</th><th className="p-3">{t.status}</th></tr>
          </thead>
          <tbody>
            {messages.map((message) => (
              <tr className="border-b border-slate-100" key={message._id}>
                <td className="p-3 text-slate-500">{message.createdAt ? new Date(message.createdAt).toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR") : "-"}</td>
                <td className="p-3">{translateLiteral(message.direction === "INBOUND" ? message.direction : message.messageType || "", locale)}</td>
                <td className="max-w-sm truncate p-3"><Link className="hover:underline" href={`/whatsapp/${message._id}`}>{message.text || "-"}</Link></td>
                <td className="p-3">{message.agentId?.fullName || message.agentId?.name || "-"}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyle[message.status || ""] || "bg-slate-100 text-slate-700"}`}>{translateLiteral(message.status || "", locale)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!messages.length && !loading ? <p className="p-4 text-sm text-slate-500">{t.empty}</p> : null}
        {loading ? <p className="p-4 text-sm text-slate-500">{t.loading}</p> : null}
      </div>
    </section>
  );
}
