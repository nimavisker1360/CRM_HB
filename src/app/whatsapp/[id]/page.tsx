import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DetailCard } from "@/components/crm/DetailCard";
import { requireSession } from "@/lib/auth/session";
import { getWhatsAppMessageById } from "@/services/whatsapp/whatsapp.service";
import { getServerLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
type Item = Record<string, unknown> & { _id: string };

export default async function WhatsAppMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const locale = await getServerLocale();
  const { id } = await params;
  const message = await getWhatsAppMessageById(id, session);
  if (!message) notFound();
  const customer = message.customerId as Item | undefined;
  const agent = message.agentId as Item | undefined;
  return <DashboardShell><PageHeader title="WhatsApp Message Detail" description="جزئیات داخلی پیام Meta Cloud API بدون نمایش Token یا Header محرمانه." /><div className="space-y-5 p-6">
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">TEST MODE</div>
    <DetailCard title="Message" items={[["Customer", customer], ["Agent", agent], ["Recipient", message.recipientPhone], ["Direction", message.direction], ["Type", message.messageType], ["Template", message.templateName], ["Language", message.templateLanguage], ["Status", message.status]]} />
    <DetailCard title="Delivery" items={[["Sent", message.sentAt], ["Delivered", message.deliveredAt], ["Read", message.readAt], ["Failed", message.failedAt], ["Error code", message.errorCode], ["Error", message.errorMessage], ["Created", message.createdAt]]} />
    <DetailCard title="Related Records" items={[["Property", message.propertyId], ["Match", message.matchId], ["Follow-up", message.followUpId]]} />
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">{locale === "tr" ? "Metin / Önizleme" : "متن / پیش‌نمایش"}</h2><pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{String(message.text || "-")}</pre></section>
  </div></DashboardShell>;
}
