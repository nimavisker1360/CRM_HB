import { notFound } from "next/navigation";
import Link from "next/link";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { DetailCard } from "@/components/crm/DetailCard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { MatchBreakdownList } from "@/components/matches/MatchBreakdownList";
import { MatchScoreBadge } from "@/components/matches/MatchScoreBadge";
import { MatchStatusActions } from "@/components/matches/MatchStatusActions";
import { RecalculateMatchesButton } from "@/components/matches/RecalculateMatchesButton";
import { requireSession } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { currency } from "@/lib/format";
import { translateLiteral } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n-server";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { Activity, Property } from "@/models";
import { findCustomersForProperty } from "@/services/matching/matching.service";

export const dynamic = "force-dynamic";

type DetailRecord = Record<string, unknown> & { _id: string };

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const locale = await getServerLocale();
  const t = locale === "tr" ? {
    agent: "Danışman", budget: "Bütçe", customer: "Müşteri", matchingCustomers: "Eşleşen müşteriler",
    matchingNote: "Bu gayrimenkul için en uygun müşteriler puana göre sıralanır.", mismatches: "Uyumsuzluklar",
    noLocation: "Tercih edilen konum yok", noMatches: "Henüz müşteri eşleşmesi oluşturulmadı.", noMismatches: "Uyumsuzluk kaydedilmedi.",
    reasons: "Nedenler", status: "Durum", unassigned: "Atanmamış", why: "Bu müşteri neden önerildi?",
  } : {
    agent: "مشاور", budget: "بودجه", customer: "مشتری", matchingCustomers: "مشتریان منطبق",
    matchingNote: "بهترین مشتریان این ملک بر اساس امتیاز مرتب شده‌اند.", mismatches: "موارد نامنطبق",
    noLocation: "موقعیت ترجیحی ثبت نشده", noMatches: "هنوز تطبیق مشتری ایجاد نشده است.", noMismatches: "هیچ مورد نامنطبقی ثبت نشده است.",
    reasons: "دلایل", status: "وضعیت", unassigned: "تخصیص‌نیافته", why: "چرا این مشتری پیشنهاد شده است؟",
  };
  await connectToDatabase();
  const { id } = await params;
  const _id = objectIdOrUndefined(id);

  if (!_id) notFound();

  const query = session.role === "AGENT" ? { _id, status: "ACTIVE" } : { _id };
  const property = serializeMongo(
    await Property.findOne(query)
      .populate("projectId", "name developer")
      .populate("assignedAgentId", "fullName email phone")
      .lean<DetailRecord | null>(),
  );

  if (!property) notFound();

  const [activities, matches] = await Promise.all([
    Activity.find({ entityType: "PROPERTY", entityId: _id }).sort({ createdAt: -1 }).limit(20).lean<DetailRecord[]>(),
    findCustomersForProperty(_id, 8, session.role === "AGENT" ? session.agentId : undefined),
  ]);

  return (
    <DashboardShell>
      <PageHeader title={String(property.title)} description="جزئیات ملک، موقعیت، قیمت، امکانات، ارتباطات و Timeline فعالیت." />
      <div className="space-y-5 p-6">
        <DetailCard
          title="Property Info"
          items={[
            ["کد", property.propertyCode],
            ["عنوان", property.title],
            ["نوع معامله", property.transactionType],
            ["نوع ملک", property.propertyType],
            ["وضعیت", property.status],
            ["پروژه", property.projectId],
            ["مشاور", property.assignedAgentId],
          ]}
        />
        <DetailCard
          title="Location & Specs"
          items={[
            ["شهر", property.city],
            ["منطقه", property.district],
            ["محله", property.neighborhood],
            ["اتاق", property.rooms],
            ["حمام", property.bathrooms],
            ["متراژ ناخالص", property.grossArea],
            ["متراژ خالص", property.netArea],
            ["طبقه", property.floor],
            ["کل طبقات", property.totalFloors],
            ["سن بنا", property.buildingAge],
          ]}
        />
        <DetailCard
          title="Price & Facilities"
          items={[
            ["قیمت", property.price],
            ["ارز", property.currency],
            ["بالکن", property.balcony],
            ["پارکینگ", property.parking],
            ["استخر", property.pool],
            ["مبله", property.furnished],
            ["مناسب شهروندی", property.citizenshipSuitable],
            ["مناسب اقامت", property.residencePermitSuitable],
            ["امکانات", property.socialFacilities],
          ]}
        />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-950">{t.matchingCustomers}</h2>
              <p className="text-sm text-slate-500">{t.matchingNote}</p>
            </div>
            {session.role === "AGENT" ? null : <RecalculateMatchesButton propertyId={String(property._id)} />}
          </div>
          <div className="space-y-3">
            {matches.map((match) => {
              const customer = match.customerId as DetailRecord | undefined;
              const agent = match.agentId as DetailRecord | undefined;
              return (
                <div className="rounded-lg border border-slate-200 p-4" key={match._id}>
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
                    <div className="min-w-0">
                      <Link className="font-medium text-slate-950 hover:underline" href={`/customers/${customer?._id}`}>
                        {String(customer?.fullName || t.customer)}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">
                        {[customer?.interestedCity, customer?.interestedDistrict].filter(Boolean).join(" / ") || t.noLocation}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {t.budget} {currency(customer?.maxBudget as number | undefined, String(customer?.currency || "TRY"), locale)} / {t.agent}{" "}
                        {String(agent?.fullName || agent?.name || t.unassigned)}
                      </p>
                    </div>
                    <MatchScoreBadge score={Number(match.score || 0)} />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500">{t.status}: {translateLiteral(String(match.status), locale)}</p>
                      <MatchStatusActions canDelete={session.role === "ADMIN"} currentStatus={String(match.status) as never} matchId={String(match._id)} />
                    </div>
                  </div>
                  <details className="mt-4 rounded-md bg-slate-50 p-3 text-sm">
                    <summary className="cursor-pointer font-medium text-slate-700">{t.why}</summary>
                    <div className="mt-3 space-y-3">
                      <MatchBreakdownList breakdown={match.breakdown as never} />
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div>
                          <p className="mb-2 font-medium text-emerald-700">{t.reasons}</p>
                          <ul className="space-y-1 text-slate-600">
                            {((match.reasons as string[]) || []).map((reason) => (
                              <li key={reason}>+ {translateLiteral(reason, locale)}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-2 font-medium text-red-700">{t.mismatches}</p>
                          <ul className="space-y-1 text-slate-600">
                            {((match.mismatches as string[]) || []).map((mismatch) => (
                              <li key={mismatch}>- {translateLiteral(mismatch, locale)}</li>
                            ))}
                            {!((match.mismatches as string[]) || []).length ? <li>{t.noMismatches}</li> : null}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              );
            })}
            {!matches.length ? <p className="text-sm text-slate-500">{t.noMatches}</p> : null}
          </div>
        </section>
        <ActivityTimeline activities={serializeMongo(activities)} locale={locale} />
      </div>
    </DashboardShell>
  );
}
