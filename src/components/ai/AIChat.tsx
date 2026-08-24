"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Bot, Clock3, ExternalLink, LoaderCircle, MessageSquarePlus, RotateCcw, Send, Trash2, UserRound } from "lucide-react";
import clsx from "clsx";
import type { AIEntity } from "@/services/ai/ai.types";
import { formatGregorianDate } from "@/lib/format";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type Conversation = { id: string; title: string; agentId: string | null; lastMessageAt: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; entities: AIEntity[] };

export function AIChat({ configured, conversations: initialConversations, initialPrompt = "", role, suggestions, workspaceAgentId }: {
  configured: boolean; conversations: Conversation[]; initialPrompt?: string; role: string; suggestions: string[]; workspaceAgentId?: string;
}) {
  const { locale } = useLanguage();
  const t = locale === "tr" ? {
    adminMissing: "Gemini API bu ortam için yapılandırılmadı.", assistant: "HB Akıllı Asistan", assistantUnavailable: "Akıllı asistan şu anda kullanılamıyor.",
    clear: "Ekranı temizle", delete: "Konuşmayı sil", empty: "Henüz bir konuşma kaydedilmedi.", error: "Akıllı asistandan yanıt alınamadı.",
    greeting: "Merhaba, ben HB Real Estate akıllı asistanıyım.", historyError: "Konuşma yüklenemedi.", loading: "CRM bilgileri inceleniyor...",
    loadingHistory: "Konuşma yükleniyor...", messageLabel: "Asistana mesaj", newConversation: "Yeni konuşma", placeholder: "CRM bilgileriyle ilgili sorunuzu yazın...",
    readOnly: "Gerçek CRM verilerine dayalı yanıt · salt okunur", recent: "Son konuşmalar", recentNote: "Yalnızca hesabınıza ait konuşmalar",
    retry: "Tekrar dene", safety: "AI hata yapabilir; nihai karar ve uygulama kullanıcıya aittir.", welcome: "Müşteriler, gayrimenkuller, eşleşmeler, takipler ve CRM performansı hakkında soru sorabilirsiniz. Yanıtlar yalnızca çalışma alanınızdaki izinli verilerden oluşturulur.",
  } : {
    adminMissing: "Gemini API برای این محیط تنظیم نشده است.", assistant: "دستیار هوشمند HB", assistantUnavailable: "دستیار هوشمند در حال حاضر در دسترس نیست.",
    clear: "پاک کردن صفحه", delete: "حذف گفتگو", empty: "هنوز گفتگویی ثبت نشده است.", error: "در دریافت پاسخ از دستیار هوشمند مشکلی ایجاد شد.",
    greeting: "سلام، من دستیار هوشمند HB Real Estate هستم.", historyError: "گفتگو بارگذاری نشد.", loading: "در حال بررسی اطلاعات CRM...",
    loadingHistory: "در حال بارگذاری گفتگو...", messageLabel: "پیام به دستیار", newConversation: "گفتگوی جدید", placeholder: "سؤال خود را درباره اطلاعات CRM بنویسید...",
    readOnly: "پاسخ مبتنی بر داده واقعی CRM · فقط خواندنی", recent: "گفتگوهای اخیر", recentNote: "فقط گفتگوهای حساب شما",
    retry: "تلاش مجدد", safety: "هوش مصنوعی ممکن است اشتباه کند؛ تصمیم نهایی و اقدام عملی با کاربر است.", welcome: "می‌توانید درباره مشتریان، املاک، تطبیق‌ها، پیگیری‌ها و عملکرد CRM سؤال کنید. پاسخ‌ها فقط از داده‌های مجاز محدوده کاری شما ساخته می‌شوند.",
  };
  const conversations = useMemo(() => initialConversations.filter((item) => (item.agentId || undefined) === workspaceAgentId), [initialConversations, workspaceAgentId]);
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event?: FormEvent, suggestedMessage?: string) {
    event?.preventDefault();
    const text = (suggestedMessage ?? message).trim();
    if (!text || loading || !configured) return;
    const optimistic: ChatMessage = { id: `user-${Date.now()}`, role: "user", content: text, entities: [] };
    setMessages((current) => [...current, optimistic]);
    setMessage(""); setError(undefined); setLoading(true);
    try {
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text, conversationId, workspaceAgentId }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(t.error);
      setConversationId(payload.data.conversationId);
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", content: payload.data.answer, entities: payload.data.entities || [] }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t.error);
    } finally { setLoading(false); }
  }

  async function openConversation(id: string) {
    if (loading) return;
    setLoadingHistory(true); setError(undefined);
    try {
      const response = await fetch(`/api/ai/conversations/${id}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(t.historyError);
      setConversationId(id); setMessages(payload.data);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : t.historyError); }
    finally { setLoadingHistory(false); }
  }

  async function deleteConversation(id: string) {
    const response = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    if (response.ok && conversationId === id) clearConversation();
  }

  function clearConversation() { setConversationId(undefined); setMessages([]); setMessage(""); setError(undefined); }

  return (
    <div className="grid min-h-[calc(100vh-12rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:grid-cols-[280px_1fr]">
      <aside className="border-b border-slate-200 bg-slate-50 xl:border-b-0 xl:border-l">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div><p className="font-semibold text-slate-950">{t.recent}</p><p className="mt-1 text-xs text-slate-500">{t.recentNote}</p></div>
          <button onClick={clearConversation} className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:text-slate-950" title={t.newConversation}><MessageSquarePlus className="size-4" /></button>
        </div>
        <div className="max-h-60 overflow-y-auto p-2 xl:max-h-[calc(100vh-17rem)]">
          {conversations.length ? conversations.map((item) => (
            <div className={clsx("group mb-1 flex items-center rounded-lg", conversationId === item.id ? "bg-slate-950 text-white" : "hover:bg-slate-200")} key={item.id}>
              <button className="min-w-0 flex-1 p-3 text-right" onClick={() => openConversation(item.id)} disabled={loadingHistory}>
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className={clsx("mt-1 flex items-center gap-1 text-xs", conversationId === item.id ? "text-slate-300" : "text-slate-500")}><Clock3 className="size-3" />{formatGregorianDate(item.lastMessageAt, locale)}</span>
              </button>
              <button className="ml-2 rounded p-1 opacity-0 transition group-hover:opacity-100" onClick={() => deleteConversation(item.id)} title={t.delete}><Trash2 className="size-3.5" /></button>
            </div>
          )) : <p className="p-4 text-sm text-slate-500">{t.empty}</p>}
        </div>
      </aside>

      <section className="flex min-h-[640px] min-w-0 flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><Bot className="size-5" /></span><div><h2 className="font-semibold text-slate-950">{t.assistant}</h2><p className="text-xs text-slate-500">{t.readOnly}</p></div></div>
          {messages.length ? <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600" onClick={clearConversation}><RotateCcw className="size-4" />{t.clear}</button> : null}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
          {!messages.length && !loadingHistory ? (
            <div className="mx-auto flex max-w-3xl flex-col items-center py-10 text-center">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-slate-950 text-white"><Bot className="size-8" /></span>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{t.greeting}</h3>
              <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">{t.welcome}</p>
              <div className="mt-7 grid w-full gap-2 sm:grid-cols-2">{suggestions.map((suggestion) => <button key={suggestion} disabled={!configured} onClick={() => submit(undefined, suggestion)} className="rounded-lg border border-slate-200 bg-white p-3 text-right text-sm leading-6 text-slate-700 transition hover:border-slate-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50">{suggestion}</button>)}</div>
            </div>
          ) : null}
          {messages.map((item) => <MessageBubble key={item.id} message={item} />)}
          {loading || loadingHistory ? <div className="flex items-center gap-3 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /><span>{loadingHistory ? t.loadingHistory : t.loading}</span></div> : null}
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button className="mt-2 font-medium underline" onClick={() => submit()}>{t.retry}</button></div> : null}
        </div>

        <form onSubmit={submit} className="border-t border-slate-200 bg-white p-4 sm:p-5">
          {!configured ? <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{role === "ADMIN" ? t.adminMissing : t.assistantUnavailable}</div> : null}
          <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-slate-500">
            <textarea aria-label={t.messageLabel} className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-3 text-sm outline-none" disabled={!configured || loading} maxLength={4000} onChange={(event) => setMessage(event.target.value)} placeholder={t.placeholder} rows={1} value={message} />
            <button className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!configured || loading || !message.trim()} type="submit"><Send className="size-4" /></button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">{t.safety}</p>
        </form>
      </section>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return <div className={clsx("flex gap-3", isUser ? "justify-start" : "justify-end")}>
    <span className={clsx("flex size-8 shrink-0 items-center justify-center rounded-full", isUser ? "bg-slate-200 text-slate-700" : "order-2 bg-violet-100 text-violet-700")}>{isUser ? <UserRound className="size-4" /> : <Bot className="size-4" />}</span>
    <div className={clsx("max-w-3xl", isUser ? "" : "order-1")}><div dir={textDirection(message.content)} className={clsx("whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7", isUser ? "rounded-tr-sm bg-slate-950 text-white" : "rounded-tl-sm border border-slate-200 bg-white text-slate-800 shadow-sm")}>{message.content}</div>
      {message.entities?.length ? <div className="mt-2 flex flex-wrap gap-2">{message.entities.map((item) => <Link key={`${item.type}-${item.id}`} href={item.url} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"><ExternalLink className="size-3" />{item.label}</Link>)}</div> : null}
    </div>
  </div>;
}

function textDirection(value: string) { return /[\u0600-\u06ff]/.test(value) ? "rtl" : "ltr"; }
