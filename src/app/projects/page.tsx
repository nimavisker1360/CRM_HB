import { WalletCards } from "lucide-react";
import { ResourceManager, type FieldOption } from "@/components/crm/ResourceManager";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const projectStatusOptions: FieldOption[] = [
  { label: "برنامه‌ریزی", value: "PLANNED" },
  { label: "فعال", value: "ACTIVE" },
  { label: "تحویل شده", value: "DELIVERED" },
  { label: "آرشیو", value: "ARCHIVED" },
];

export default async function ProjectsPage() {
  const session = await requireSession();
  const canManageProjects = session.role === "ADMIN";

  return (
    <DashboardShell>
      <PageHeader
        action={<WalletCards className="size-5 text-slate-400" />}
        title="پروژه‌ها"
        description="مدیریت پروژه‌های ساختمانی، سازنده، موقعیت، شرایط پرداخت و واحدهای مرتبط."
      />
      <ResourceManager
        archivePayload={{ status: "ARCHIVED" }}
        canArchive={canManageProjects}
        canCreate={canManageProjects}
        canDelete={canManageProjects}
        canEdit={canManageProjects}
        columns={[
          { key: "name", label: "نام پروژه" },
          { key: "developer", label: "سازنده" },
          { key: "city", label: "شهر" },
          { key: "district", label: "منطقه" },
          { key: "deliveryDate", label: "تحویل" },
          { key: "status", label: "وضعیت" },
          { key: "createdAt", label: "تاریخ ثبت" },
        ]}
        detailBasePath="/projects"
        endpoint="/api/projects"
        fields={[
          { label: "نام پروژه", name: "name", required: true, section: "اطلاعات پروژه" },
          { label: "سازنده", name: "developer", section: "اطلاعات پروژه" },
          { label: "شهر", name: "city", required: true, section: "موقعیت" },
          { label: "منطقه", name: "district", section: "موقعیت" },
          { label: "تاریخ تحویل", name: "deliveryDate", section: "اطلاعات پروژه", type: "date" },
          { label: "وضعیت", name: "status", options: projectStatusOptions, section: "اطلاعات پروژه", type: "select" },
          { label: "مناسب شهروندی", name: "citizenshipSuitable", section: "مزایا", type: "checkbox" },
          { label: "مناسب اقامت", name: "residenceSuitable", section: "مزایا", type: "checkbox" },
          { label: "امکانات (با کاما)", name: "facilities", section: "مزایا" },
          { label: "تصاویر پروژه", name: "images", section: "رسانه", type: "image-upload", uploadDirectory: "projects/images" },
          { label: "مدارک (URL با کاما)", name: "documents", section: "رسانه" },
          { label: "شرایط پرداخت", name: "paymentPlan", section: "پرداخت", type: "textarea" },
          { label: "توضیحات", name: "description", section: "توضیحات", type: "textarea" },
        ]}
        filters={[
          { label: "شهر", name: "city" },
          { label: "منطقه", name: "district" },
          ...(canManageProjects ? [{ label: "وضعیت", name: "status", options: projectStatusOptions, type: "select" as const }] : []),
        ]}
        primaryLabel="پروژه"
      />
    </DashboardShell>
  );
}
