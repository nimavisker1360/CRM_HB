import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { MatchBreakdownList } from "@/components/matches/MatchBreakdownList";
import { MatchScoreBadge } from "@/components/matches/MatchScoreBadge";
import { MatchStatusActions } from "@/components/matches/MatchStatusActions";
import { Badge } from "@/components/ui/Badge";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { canAccessScopedRecord } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { currency, formatGregorianDate } from "@/lib/format";
import { translateLiteral } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n-server";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { PropertyMatch } from "@/models";
import { WhatsAppComposer } from "@/components/whatsapp/WhatsAppComposer";

export const dynamic = "force-dynamic";

type DetailRecord = Record<string, unknown> & { _id: string };

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const locale = await getServerLocale();
  const t = locale === "tr" ? {
    accessDenied: "Bu eşleşmeye erişim yetkiniz yok.", agent: "Danışman", budget: "Bütçe", created: "Oluşturulma",
    customer: "Müşteri", lastCalculated: "Son hesaplama", mismatches: "Uyumsuzluklar", noMismatches: "Uyumsuzluk kaydedilmedi.",
    noReasons: "Neden kaydedilmedi.", property: "Gayrimenkul", reasons: "Nedenler", scoreBreakdown: "Puan dökümü",
    sendWhatsApp: "Bu gayrimenkulü WhatsApp ile gönder", unassigned: "Atanmamış", version: "Sürüm",
  } : {
    accessDenied: "شما به این تطبیق دسترسی ندارید.", agent: "مشاور", budget: "بودجه", created: "تاریخ ایجاد",
    customer: "مشتری", lastCalculated: "آخرین محاسبه", mismatches: "موارد نامنطبق", noMismatches: "هیچ مورد نامنطبقی ثبت نشده است.",
    noReasons: "هیچ دلیلی ثبت نشده است.", property: "ملک", reasons: "دلایل", scoreBreakdown: "جزئیات امتیاز",
    sendWhatsApp: "ارسال این ملک در واتساپ", unassigned: "تخصیص‌نیافته", version: "نسخه",
  };
  await connectToDatabase();
  const { id } = await params;
  const _id = objectIdOrUndefined(id);
  if (!_id) notFound();

  const match = serializeMongo(
    await PropertyMatch.findOne({ _id })
      .populate("customerId", "fullName phone whatsapp status minBudget maxBudget currency interestedCity interestedDistrict minRooms maxRooms minArea maxArea propertyType")
      .populate({
        path: "propertyId",
        populate: { path: "projectId", select: "name developer" },
      })
      .populate("agentId", "fullName name email phone")
      .lean<DetailRecord | null>(),
  );

  if (!match) notFound();
  if (!canAccessScopedRecord(session, match)) {
    return (
      <DashboardShell>
        <AccessDenied message={t.accessDenied} />
      </DashboardShell>
    );
  }

  const customer = match.customerId as DetailRecord | undefined;
  const property = match.propertyId as DetailRecord | undefined;
  const project = property?.projectId as DetailRecord | undefined;
  const agent = match.agentId as DetailRecord | undefined;
  const whatsappProperty = {
    city: property?.city ? String(property.city) : undefined,
    currency: property?.currency ? String(property.currency) : undefined,
    district: property?.district ? String(property.district) : undefined,
    grossArea: property?.grossArea ? Number(property.grossArea) : undefined,
    id: String(property?._id || ""),
    images: Array.isArray(property?.images) ? property.images.map(String) : [],
    price: property?.price ? Number(property.price) : undefined,
    rooms: property?.rooms ? Number(property.rooms) : undefined,
    title: String(property?.title || "Property"),
    videoUrl: property?.videoUrl ? String(property.videoUrl) : undefined,
  };

  return (
    <DashboardShell>
      <PageHeader title="Match Detail" description="Score breakdown, reasons, mismatches, status and source records." />
      <div className="space-y-5 p-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">{t.customer}</p>
              <Link className="mt-1 block font-semibold text-slate-950 hover:underline" href={`/customers/${customer?._id}`}>
                {String(customer?.fullName || "-")}
              </Link>
              <p className="text-sm text-slate-500" dir="ltr">{String(customer?.whatsapp || "")}</p>
              <p className="mt-2 text-sm text-slate-700">
                {t.budget} {currency(customer?.maxBudget as number | undefined, String(customer?.currency || "TRY"), locale)}
              </p>
              <p className="text-sm text-slate-500">
                {[customer?.interestedCity, customer?.interestedDistrict].filter(Boolean).join(" / ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">{t.property}</p>
              <Link className="mt-1 block font-semibold text-slate-950 hover:underline" href={`/properties/${property?._id}`}>
                {String(property?.title || "-")}
              </Link>
              <p className="text-sm text-slate-500">{String(project?.name || property?.propertyCode || "")}</p>
              <p className="mt-2 text-sm text-slate-700">
                {currency(property?.price as number | undefined, String(property?.currency || "TRY"), locale)}
              </p>
              <p className="text-sm text-slate-500">
                {[property?.city, property?.district].filter(Boolean).join(" / ")}
              </p>
            </div>
            <div className="space-y-3">
              <MatchScoreBadge score={Number(match.score || 0)} />
              <Badge>{String(match.status)}</Badge>
              <MatchStatusActions canDelete currentStatus={String(match.status) as never} matchId={String(match._id)} />
              {customer?._id && property?._id ? (
                <WhatsAppComposer
                  agent={agent ? { fullName: String(agent.fullName || ""), name: String(agent.name || "") } : undefined}
                  buttonLabel={t.sendWhatsApp}
                  customer={{
                    fullName: String(customer.fullName || t.customer),
                    id: String(customer._id),
                    phone: customer.phone ? String(customer.phone) : undefined,
                    whatsapp: customer.whatsapp ? String(customer.whatsapp) : undefined,
                  }}
                  matches={[{ id: String(match._id), property: whatsappProperty, score: Number(match.score || 0) }]}
                  preselectedMatchId={String(match._id)}
                  preselectedType="MATCH"
                  properties={[whatsappProperty]}
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">{t.scoreBreakdown}</h2>
          <MatchBreakdownList breakdown={match.breakdown as never} />
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <p>{t.agent}: {String(agent?.fullName || agent?.name || t.unassigned)}</p>
            <p>{t.created}: {formatGregorianDate(match.createdAt, locale)}</p>
            <p>{t.lastCalculated}: {formatGregorianDate(match.lastCalculatedAt, locale)}</p>
            <p>{t.version}: {String(match.calculationVersion || "-")}</p>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-emerald-700">{t.reasons}</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {((match.reasons as string[]) || []).map((reason) => (
                <li className="rounded-md bg-emerald-50 px-3 py-2" key={reason}>
                  + {translateLiteral(reason, locale)}
                </li>
              ))}
              {!((match.reasons as string[]) || []).length ? <li>{t.noReasons}</li> : null}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-red-700">{t.mismatches}</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {((match.mismatches as string[]) || []).map((mismatch) => (
                <li className="rounded-md bg-red-50 px-3 py-2" key={mismatch}>
                  - {translateLiteral(mismatch, locale)}
                </li>
              ))}
              {!((match.mismatches as string[]) || []).length ? <li>{t.noMismatches}</li> : null}
            </ul>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
