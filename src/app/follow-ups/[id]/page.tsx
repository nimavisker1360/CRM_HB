import { ArrowRight, CalendarCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailCard } from "@/components/crm/DetailCard";
import { FollowUpStatusAction } from "@/components/crm/FollowUpStatusAction";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { canAccessScopedRecord } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { translateLiteral } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n-server";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { FollowUp } from "@/models";
import { WhatsAppComposer } from "@/components/whatsapp/WhatsAppComposer";

export const dynamic = "force-dynamic";

type DetailRecord = Record<string, unknown> & { _id: string };

export default async function FollowUpDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const locale = await getServerLocale();
  const t = locale === "tr" ? {
    accessDenied: "Bu takibe erişim yetkiniz yok.",
    back: "Takiplere dön",
    customer: "Müşteri",
    customerFile: "Müşteri kaydını görüntüle",
    description: "Atanan takibin ayrıntıları ve müşteri iletişim bilgileri.",
    prepareMessage: "Mesaj hazırla",
    title: "Takip",
  } : {
    accessDenied: "شما به این پیگیری دسترسی ندارید.",
    back: "بازگشت به پیگیری‌ها",
    customer: "مشتری",
    customerFile: "مشاهده پرونده مشتری",
    description: "جزئیات کامل پیگیری اختصاص‌داده‌شده و اطلاعات تماس مشتری.",
    prepareMessage: "پیام آماده کن",
    title: "پیگیری",
  };
  await connectToDatabase();
  const { id } = await params;
  const _id = objectIdOrUndefined(id);

  if (!_id) notFound();

  const record = await FollowUp.findById(_id)
    .populate("customerId", "fullName phone whatsapp email status")
    .populate("customer", "fullName phone whatsapp email status")
    .populate("agentId", "fullName name email phone")
    .populate("assignedAgent", "fullName name email phone")
    .populate("createdBy", "name email")
    .lean<DetailRecord | null>();

  if (!record) notFound();
  if (!canAccessScopedRecord(session, record)) {
    return (
      <DashboardShell>
        <AccessDenied message={t.accessDenied} />
      </DashboardShell>
    );
  }

  const followUp = serializeMongo(record);
  const customer = (followUp.customerId || followUp.customer) as DetailRecord | undefined;
  const agent = (followUp.agentId || followUp.assignedAgent) as DetailRecord | undefined;
  const status = String(followUp.status || "PENDING");
  const type = String(followUp.type || followUp.channel || "CALL");

  return (
    <DashboardShell>
      <PageHeader
        action={
          <div className="flex flex-wrap items-start gap-2">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              href="/follow-ups"
            >
              <ArrowRight className="size-4" />
              {t.back}
            </Link>
            <FollowUpStatusAction followUpId={String(followUp._id)} status={status} />
          </div>
        }
        description={t.description}
        title={`${t.title} ${String(customer?.fullName || t.customer)}`}
      />

      <div className="space-y-5 p-6">
        <section className="grid gap-5 xl:grid-cols-2">
          <DetailCard
            title="اطلاعات پیگیری"
            items={[
              ["نوع", translateLiteral(type, locale)],
              ["وضعیت", translateLiteral(status, locale)],
              ["زمان برنامه‌ریزی", followUp.scheduledAt || followUp.dueAt],
              ["مشاور", agent],
              ["ثبت‌کننده", followUp.createdBy],
              ["زمان ثبت", followUp.createdAt],
            ]}
          />
          <DetailCard
            title="اطلاعات مشتری"
            items={[
              ["نام", customer?.fullName],
              ["تلفن", customer?.phone],
              ["واتساپ", customer?.whatsapp],
              ["ایمیل", customer?.email],
              ["وضعیت مشتری", customer?.status],
            ]}
          />
        </section>

        <DetailCard
          title="شرح و نتیجه"
          items={[
            ["یادداشت", followUp.note || followUp.notes],
            ["نتیجه", followUp.result],
            ["زمان انجام", followUp.completedAt],
          ]}
        />

        {customer?._id ? (
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              href={`/customers/${customer._id}`}
            >
              <CalendarCheck className="size-4" />
              {t.customerFile}
            </Link>
            {type === "WHATSAPP" ? (
              <WhatsAppComposer
                agent={agent ? { fullName: String(agent.fullName || ""), name: String(agent.name || "") } : undefined}
                buttonLabel={t.prepareMessage}
                customer={{
                  fullName: String(customer.fullName || t.customer),
                  id: String(customer._id),
                  phone: customer.phone ? String(customer.phone) : undefined,
                  whatsapp: customer.whatsapp ? String(customer.whatsapp) : undefined,
                }}
                followUp={{ id: String(followUp._id), note: String(followUp.note || followUp.notes || "") }}
                preselectedType="FOLLOWUP"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
