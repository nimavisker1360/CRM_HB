import Link from "next/link";
import { WhatsAppMessageDeleteButton } from "@/components/whatsapp/WhatsAppMessageDeleteButton";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { agentScopeFilter, getAgentScope, firstParam } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { Agent, Customer } from "@/models";
import { getWhatsAppMessages } from "@/services/whatsapp/whatsapp.service";
import { getServerLocale } from "@/lib/i18n-server";
import { translateLiteral } from "@/lib/i18n";
import { formatGregorianDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
type Search = Record<string, string | string[] | undefined>;
type Item = Record<string, unknown> & { _id: string };
const statusClass: Record<string, string> = { DELIVERED: "bg-blue-100 text-blue-700", FAILED: "bg-red-100 text-red-700", READ: "bg-violet-100 text-violet-700", SENT: "bg-emerald-100 text-emerald-700" };

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireSession();
  const locale = await getServerLocale();
  const t = locale === "tr" ? {
    agent: "Danışman", allAgents: "Tüm danışmanlar", allCustomers: "Tüm müşteriler", allDirections: "Tüm yönler", allStatuses: "Tüm durumlar",
    apply: "Filtreleri uygula", customer: "Müşteri", date: "Tarih", description: "Test ortamında Meta Cloud API mesajlarını ve teslim durumlarını izleyin.",
    detail: "İşlemler", direction: "Yön", empty: "Bu filtrelerle eşleşen mesaj bulunamadı.", message: "mesaj", of: "/", page: "sayfa",
    status: "Durum", testNote: "Mesajlar şirketin üretim numarası yerine Meta WhatsApp test numarasından gönderilir.", title: "WhatsApp Mesajları",
    type: "Tür", unknown: "Bilinmeyen numara", view: "Görüntüle", sendProperty: "Müşteriye gayrimenkul gönder",
  } : {
    agent: "مشاور", allAgents: "همه مشاوران", allCustomers: "همه مشتریان", allDirections: "همه جهت‌ها", allStatuses: "همه وضعیت‌ها",
    apply: "اعمال فیلتر", customer: "مشتری", date: "تاریخ", description: "نظارت بر پیام‌های Meta Cloud API و وضعیت تحویل در محیط آزمایشی.",
    detail: "عملیات", direction: "جهت", empty: "پیامی با این فیلترها پیدا نشد.", message: "پیام", of: "از", page: "صفحه",
    status: "وضعیت", testNote: "پیام‌ها از شماره آزمایشی Meta WhatsApp ارسال می‌شوند، نه شماره اصلی شرکت.", title: "پیام‌های واتساپ",
    type: "نوع", unknown: "شماره ناشناس", view: "مشاهده", sendProperty: "ارسال ملک به مشتری",
  };
  await connectToDatabase();
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, item] of Object.entries(raw)) { const value = firstParam(item); if (value) params.set(key, value); }
  const requestedAgentId = params.get("agentId");
  const scope = getAgentScope(session, requestedAgentId);
  const { items, pagination } = await getWhatsAppMessages(params, session, scope);
  const [agents, customers] = await Promise.all([
    session.role === "AGENT" ? [] : Agent.find({ isActive: { $ne: false } }).select("_id fullName name").sort({ fullName: 1 }).lean(),
    Customer.find(agentScopeFilter(scope)).select("_id fullName").sort({ fullName: 1 }).limit(250).lean(),
  ]);

  return (
    <DashboardShell>
      <PageHeader
        action={(
          <Link
            className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700"
            href={scope.effectiveAgentId ? `/matches?agentId=${scope.effectiveAgentId}` : "/matches"}
          >
            {t.sendProperty}
          </Link>
        )}
        title={t.title}
        description={t.description}
      />
      <div className="space-y-5 p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>TEST MODE</b> — {t.testNote}</div>
        <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 xl:grid-cols-6">
          <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue={params.get("status") || ""} name="status"><option value="">{t.allStatuses}</option>{["QUEUED", "SENDING", "SENT", "DELIVERED", "READ", "FAILED"].map((value) => <option key={value} value={value}>{translateLiteral(value, locale)}</option>)}</select>
          <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue={params.get("direction") || ""} name="direction"><option value="">{t.allDirections}</option><option value="OUTBOUND">{translateLiteral("OUTBOUND", locale)}</option><option value="INBOUND">{translateLiteral("INBOUND", locale)}</option></select>
          {session.role !== "AGENT" ? <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue={requestedAgentId || ""} name="agentId"><option value="">{t.allAgents}</option>{serializeMongo(agents).map((agent) => <option key={String(agent._id)} value={String(agent._id)}>{String(agent.fullName || agent.name)}</option>)}</select> : null}
          <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue={params.get("customerId") || ""} name="customerId"><option value="">{t.allCustomers}</option>{serializeMongo(customers).map((customer) => <option key={String(customer._id)} value={String(customer._id)}>{String(customer.fullName)}</option>)}</select>
          <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={params.get("from") || ""} name="from" type="date" />
          <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" defaultValue={params.get("to") || ""} name="to" type="date" />
          <button className="h-10 rounded-md bg-slate-950 px-4 text-sm font-medium text-white" type="submit">{t.apply}</button>
        </form>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-start text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">{t.date}</th><th className="p-3">{t.customer}</th><th className="p-3">{t.direction}</th><th className="p-3">{t.type}</th><th className="p-3">{t.agent}</th><th className="p-3">{t.status}</th><th className="p-3">{t.detail}</th></tr></thead>
            <tbody>{(items as Item[]).map((message) => { const customer = message.customerId as Item | undefined; const agent = message.agentId as Item | undefined; return <tr className="border-b border-slate-100" key={message._id}><td className="p-3 text-slate-500">{formatGregorianDateTime(message.createdAt, locale)}</td><td className="p-3">{String(customer?.fullName || t.unknown)}</td><td className="p-3">{translateLiteral(String(message.direction), locale)}</td><td className="p-3">{translateLiteral(String(message.messageType), locale)}</td><td className="p-3">{String(agent?.fullName || agent?.name || "-")}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass[String(message.status)] || "bg-slate-100 text-slate-700"}`}>{translateLiteral(String(message.status), locale)}</span></td><td className="p-3"><div className="flex items-center gap-3"><Link className="font-medium text-slate-700 hover:underline" href={`/whatsapp/${message._id}`}>{t.view}</Link><WhatsAppMessageDeleteButton messageId={String(message._id)} /></div></td></tr>; })}</tbody>
          </table>
          {!items.length ? <p className="p-5 text-sm text-slate-500">{t.empty}</p> : null}
        </div>
        <p className="text-sm text-slate-500">{pagination.total.toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")} {t.message} — {t.page} {pagination.page.toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")} {t.of} {pagination.pages.toLocaleString(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn")}</p>
      </div>
    </DashboardShell>
  );
}
