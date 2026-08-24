"use client";

import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type Props = {
  agentId?: string;
  customerId: string;
};

type ApiResponse = { success: true; data: unknown } | { success: false; error: { message: string } };

export function CustomerFollowUpForm({ agentId, customerId }: Props) {
  const { locale } = useLanguage();
  const t = locale === "tr" ? {
    call: "Telefon", email: "E-posta", meeting: "Görüşme", note: "Not",
    propertyVisit: "Gayrimenkul ziyareti", saved: "Yeni takip kaydedildi.", submit: "Takibi kaydet", whatsapp: "WhatsApp",
  } : {
    call: "تماس", email: "ایمیل", meeting: "جلسه", note: "یادداشت",
    propertyVisit: "بازدید ملک", saved: "پیگیری جدید ثبت شد.", submit: "ثبت پیگیری", whatsapp: "واتساپ",
  };
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/follow-ups", {
      body: JSON.stringify({
        agentId,
        customerId,
        note: formData.get("note"),
        scheduledAt: formData.get("scheduledAt"),
        type: formData.get("type"),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await response.json()) as ApiResponse;

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setMessage(t.saved);
    event.currentTarget.reset();
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" name="type">
          <option value="CALL">{t.call}</option>
          <option value="WHATSAPP">{t.whatsapp}</option>
          <option value="EMAIL">{t.email}</option>
          <option value="MEETING">{t.meeting}</option>
          <option value="PROPERTY_VISIT">{t.propertyVisit}</option>
        </select>
        <input
          className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          dir="ltr"
          lang="en-GB"
          name="scheduledAt"
          required
          type="datetime-local"
        />
      </div>
      <textarea
        className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        name="note"
        placeholder={t.note}
      />
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white" type="submit">
        <CalendarPlus className="size-4" />
        {t.submit}
      </button>
    </form>
  );
}
