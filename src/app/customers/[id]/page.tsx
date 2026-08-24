import { notFound } from "next/navigation";
import Link from "next/link";
import { CustomerFollowUpForm } from "@/components/crm/CustomerFollowUpForm";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { DetailCard } from "@/components/crm/DetailCard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { MatchBreakdownList } from "@/components/matches/MatchBreakdownList";
import { MatchScoreBadge } from "@/components/matches/MatchScoreBadge";
import { MatchStatusActions } from "@/components/matches/MatchStatusActions";
import { RecalculateMatchesButton } from "@/components/matches/RecalculateMatchesButton";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { canAccessScopedRecord } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { currency, formatGregorianDateTime } from "@/lib/format";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { Activity, Customer, FollowUp } from "@/models";
import { findMatchesForCustomer } from "@/services/matching/matching.service";
import { CustomerWhatsAppPanel } from "@/components/whatsapp/CustomerWhatsAppPanel";
import { getServerLocale } from "@/lib/i18n-server";
import { translateLiteral } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type DetailRecord = Record<string, unknown> & { _id: string };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const locale = await getServerLocale();
  const t = locale === "tr" ? {
    addFollowUp: "Yeni takip ekle",
    activityTimeline: "Aktivite zaman çizelgesi",
    agent: "Danışman",
    area: "Alan",
    budgetAgent: "Bütçe ve sorumlu danışman",
    customerInfo: "Müşteri bilgileri",
    date: "Tarih",
    email: "E-posta",
    followUps: "Takipler",
    language: "Dil",
    maxBudget: "Maksimum bütçe",
    minBudget: "Minimum bütçe",
    nationality: "Uyruk",
    nextFollowUp: "Sonraki takip",
    noActivities: "Henüz aktivite kaydedilmedi.",
    noFollowUps: "Henüz takip kaydedilmedi.",
    noMatches: "Henüz bir gayrimenkul eşleşmesi oluşturulmadı.",
    noMismatches: "Herhangi bir uyumsuzluk kaydedilmedi.",
    notes: "Notlar",
    pageDescription: "Müşteri profili, ihtiyaçları, takipleri ve aktivite geçmişi.",
    property: "Gayrimenkul",
    projectSuggestions: "Proje önerilerini gör",
    reasons: "Eşleşme nedenleri",
    recommended: "Önerilen gayrimenkuller",
    recommendedNote: "Eşleşmeler uygunluk puanına göre sıralanır.",
    requirements: "Müşteri ihtiyaçları",
    rooms: "Oda",
    source: "Kaynak",
    status: "Durum",
    transaction: "İşlem türü",
    type: "Gayrimenkul türü",
    why: "Bu gayrimenkul neden önerildi?",
  } : {
    addFollowUp: "ثبت پیگیری جدید",
    activityTimeline: "خط زمانی فعالیت‌ها",
    agent: "مشاور",
    area: "متراژ",
    budgetAgent: "بودجه و مشاور مسئول",
    customerInfo: "اطلاعات مشتری",
    date: "تاریخ",
    email: "ایمیل",
    followUps: "پیگیری‌ها",
    language: "زبان",
    maxBudget: "حداکثر بودجه",
    minBudget: "حداقل بودجه",
    nationality: "ملیت",
    nextFollowUp: "پیگیری بعدی",
    noActivities: "هنوز فعالیتی ثبت نشده است.",
    noFollowUps: "هنوز پیگیری‌ای ثبت نشده است.",
    noMatches: "هنوز ملک پیشنهادی برای این مشتری ایجاد نشده است.",
    noMismatches: "هیچ مورد نامنطبقی ثبت نشده است.",
    notes: "یادداشت‌ها",
    pageDescription: "پرونده کامل مشتری، نیازمندی‌ها، پیگیری‌ها و سابقه فعالیت‌ها.",
    property: "ملک",
    projectSuggestions: "مشاهده پروژه‌های پیشنهادی",
    reasons: "دلایل تطبیق",
    recommended: "املاک پیشنهادی",
    recommendedNote: "پیشنهادها بر اساس میزان تناسب با نیاز مشتری مرتب شده‌اند.",
    requirements: "نیازمندی‌های مشتری",
    rooms: "اتاق",
    source: "منبع",
    status: "وضعیت",
    transaction: "نوع معامله",
    type: "نوع ملک",
    why: "چرا این ملک پیشنهاد شده است؟",
  };
  await connectToDatabase();
  const { id } = await params;
  const _id = objectIdOrUndefined(id);

  if (!_id) notFound();

  const customer = serializeMongo(
    await Customer.findOne({ _id }).populate("assignedAgentId", "fullName email phone").lean<DetailRecord | null>(),
  );

  if (!customer) notFound();
  if (!canAccessScopedRecord(session, customer)) {
    return (
      <DashboardShell>
        <AccessDenied message="شما به این مشتری دسترسی ندارید." />
      </DashboardShell>
    );
  }

  const [followUps, activities, matches] = await Promise.all([
    FollowUp.find({ customerId: _id, ...(session.role === "AGENT" ? { agentId: session.agentId || "__no_agent__" } : {}) })
      .sort({ scheduledAt: 1 })
      .limit(20)
      .lean<DetailRecord[]>(),
    Activity.find({ entityType: "CUSTOMER", entityId: _id }).sort({ createdAt: -1 }).limit(30).lean<DetailRecord[]>(),
    findMatchesForCustomer(_id, 8),
  ]);
  const assignedAgent = customer.assignedAgentId as DetailRecord | undefined;
  const whatsappMatches = matches.map((match) => {
    const property = match.propertyId as DetailRecord;
    return {
      id: String(match._id),
      property: {
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
      },
      score: Number(match.score || 0),
    };
  });
  const whatsappProperties = Array.from(
    new Map(whatsappMatches.map((match) => [match.property.id, match.property])).values(),
  ).filter((property) => property.id);

  return (
    <DashboardShell>
      <PageHeader
        action={(
          <Link
            className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700"
            href={`/matches?customerId=${customer._id}`}
          >
            {t.projectSuggestions}
          </Link>
        )}
        title={String(customer.fullName)}
        description={t.pageDescription}
      />
      <div className="mx-auto max-w-[1540px] space-y-5 p-4 sm:p-7">
        <DetailCard
          title={t.customerInfo}
          items={[
            ["نام", customer.fullName],
            ["واتساپ", customer.whatsapp],
            [t.email, customer.email],
            [t.nationality, customer.nationality],
            [t.language, customer.language],
            [t.source, customer.source],
            [t.status, customer.status],
          ]}
        />
        <CustomerWhatsAppPanel
          agent={assignedAgent ? { fullName: String(assignedAgent.fullName || ""), name: String(assignedAgent.name || "") } : undefined}
          customer={{
            fullName: String(customer.fullName),
            id: String(customer._id),
            phone: customer.phone ? String(customer.phone) : undefined,
            whatsapp: customer.whatsapp ? String(customer.whatsapp) : undefined,
          }}
          matches={whatsappMatches}
          properties={whatsappProperties}
        />
        <DetailCard
          title={t.requirements}
          items={[
            ["شهر", customer.interestedCity],
            ["منطقه", customer.interestedDistrict],
            [t.transaction, customer.transactionType],
            [t.type, customer.propertyType],
            [t.rooms, `${customer.minRooms || "-"} ${locale === "tr" ? "-" : "تا"} ${customer.maxRooms || "-"}`],
            [t.area, `${customer.minArea || "-"} ${locale === "tr" ? "-" : "تا"} ${customer.maxArea || "-"}`],
          ]}
        />
        <DetailCard
          title={t.budgetAgent}
          items={[
            [t.minBudget, customer.minBudget],
            [t.maxBudget, customer.maxBudget],
            ["ارز", customer.currency],
            [t.agent, customer.assignedAgentId],
            [t.nextFollowUp, customer.nextFollowUp],
            [t.notes, customer.notes],
          ]}
        />
        <section className="grid gap-5 xl:grid-cols-2">
          <div className="app-card p-5 sm:p-6">
            <h2 className="mb-4 font-extrabold text-slate-950">{t.followUps}</h2>
            <div className="space-y-3">
              {serializeMongo(followUps).map((followUp) => (
                <div className="rounded-md border border-slate-200 p-3 text-sm" key={followUp._id}>
                  <p className="font-medium text-slate-800">{translateLiteral(String(followUp.type || followUp.title), locale)}</p>
                  <p className="text-slate-500">{formatGregorianDateTime(followUp.scheduledAt || followUp.dueAt, locale)}</p>
                  <p className="text-slate-600">{String(followUp.note || followUp.notes || "")}</p>
                </div>
              ))}
              {!followUps.length ? <p className="text-sm text-slate-500">{t.noFollowUps}</p> : null}
            </div>
          </div>
          <div className="app-card p-5 sm:p-6">
            <h2 className="mb-4 font-extrabold text-slate-950">{t.addFollowUp}</h2>
            <CustomerFollowUpForm agentId={String((customer.assignedAgentId as DetailRecord | undefined)?._id || "")} customerId={String(customer._id)} />
          </div>
        </section>
        <section className="app-card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-slate-950">{t.recommended}</h2>
              <p className="mt-1 text-sm text-slate-500">{t.recommendedNote}</p>
            </div>
            <RecalculateMatchesButton customerId={String(customer._id)} />
          </div>
          <div className="space-y-3">
            {matches.map((match) => {
              const property = match.propertyId as DetailRecord | undefined;
              const project = property?.projectId as DetailRecord | undefined;
              return (
                <div className="rounded-lg border border-slate-200 p-4" key={match._id}>
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
                    <div className="min-w-0">
                      <Link className="font-medium text-slate-950 hover:underline" href={`/properties/${property?._id}`}>
                        {String(property?.title || t.property)}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">
                        {[project?.name, property?.city, property?.district].filter(Boolean).join(" / ")}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {currency(property?.price as number | undefined, String(property?.currency || "TRY"), locale)} / {String(property?.rooms || "-")} {t.rooms} /{" "}
                        {String(property?.grossArea || "-")} m²
                      </p>
                    </div>
                    <MatchScoreBadge score={Number(match.score || 0)} />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500">{t.status}: {translateLiteral(String(match.status), locale)}</p>
                      <MatchStatusActions canDelete currentStatus={String(match.status) as never} matchId={String(match._id)} />
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
                          <p className="mb-2 font-medium text-red-700">{locale === "tr" ? "Uyumsuzluklar" : "موارد نامنطبق"}</p>
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
        <ActivityTimeline
          activities={serializeMongo(activities)}
          emptyMessage={t.noActivities}
          locale={locale}
          title={t.activityTimeline}
        />
      </div>
    </DashboardShell>
  );
}
