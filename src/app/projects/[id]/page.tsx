import { notFound } from "next/navigation";
import { DetailCard } from "@/components/crm/DetailCard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/auth/session";
import { objectIdOrUndefined } from "@/lib/crm-utils";
import { getServerLocale } from "@/lib/i18n-server";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { Project, Property } from "@/models";

export const dynamic = "force-dynamic";

type DetailRecord = Record<string, unknown> & { _id: string };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const locale = await getServerLocale();
  const t = locale === "tr" ? {
    availableProperties: "Mevcut gayrimenkuller",
    empty: "Bu proje için henüz bir gayrimenkul kaydedilmedi.",
    meter: "metre",
    room: "oda",
  } : {
    availableProperties: "املاک موجود",
    empty: "هنوز واحدی برای این پروژه ثبت نشده است.",
    meter: "متر",
    room: "اتاق",
  };
  await connectToDatabase();
  const { id } = await params;
  const _id = objectIdOrUndefined(id);

  if (!_id) notFound();

  const visibilityFilter = session.role === "AGENT" ? { _id, status: "ACTIVE" } : { _id };
  const project = serializeMongo(await Project.findOne(visibilityFilter).lean<DetailRecord | null>());
  if (!project) notFound();

  const properties = serializeMongo(
    await Property.find({ projectId: _id, ...(session.role === "AGENT" ? { status: "ACTIVE" } : {}) })
      .sort({ createdAt: -1 })
      .select("propertyCode title city district rooms grossArea price currency status")
      .lean<DetailRecord[]>(),
  );

  return (
    <DashboardShell>
      <PageHeader title={String(project.name)} description="جزئیات پروژه، سازنده، موقعیت، شرایط پرداخت و واحدهای مرتبط." />
      <div className="space-y-5 p-6">
        <DetailCard
          title="Project Info"
          items={[
            ["نام", project.name],
            ["سازنده", project.developer],
            ["شهر", project.city],
            ["منطقه", project.district],
            ["تحویل", project.deliveryDate],
            ["وضعیت", project.status],
            ["مناسب شهروندی", project.citizenshipSuitable],
            ["مناسب اقامت", project.residenceSuitable],
            ["امکانات", project.facilities],
          ]}
        />
        <DetailCard title="Payment Plan" items={[["شرایط پرداخت", project.paymentPlan], ["توضیحات", project.description]]} />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-950">{t.availableProperties}</h2>
          <div className="grid gap-3">
            {properties.map((property) => (
              <div className="grid gap-2 rounded-md border border-slate-200 p-3 text-sm md:grid-cols-5" key={property._id}>
                <span className="font-medium text-slate-800">{String(property.title)}</span>
                <span>{String(property.propertyCode)}</span>
                <span>{String(property.rooms || "-")} {t.room}</span>
                <span>{String(property.grossArea || "-")} {t.meter}</span>
                <span>{String(property.price || "-")} {String(property.currency || "")}</span>
              </div>
            ))}
            {!properties.length ? <p className="text-sm text-slate-500">{t.empty}</p> : null}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
