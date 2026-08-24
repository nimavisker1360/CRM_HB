import { Building2 } from "lucide-react";
import { ResourceManager, type FieldOption } from "@/components/crm/ResourceManager";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const transactionOptions: FieldOption[] = [
  { label: "فروش", value: "SALE" },
  { label: "اجاره", value: "RENT" },
];
const propertyTypeOptions: FieldOption[] = [
  { label: "آپارتمان", value: "APARTMENT" },
  { label: "ویلا", value: "VILLA" },
  { label: "زمین", value: "LAND" },
  { label: "تجاری", value: "COMMERCIAL" },
  { label: "اداری", value: "OFFICE" },
  { label: "مغازه", value: "SHOP" },
];
const propertyStatusOptions: FieldOption[] = [
  { label: "فعال", value: "ACTIVE" },
  { label: "رزرو", value: "RESERVED" },
  { label: "فروخته شده", value: "SOLD" },
  { label: "اجاره رفته", value: "RENTED" },
  { label: "غیرفعال", value: "PASSIVE" },
];
const currencyOptions: FieldOption[] = ["TRY", "USD", "EUR", "GBP"].map((value) => ({ label: value, value }));

export default async function PropertiesPage() {
  const session = await requireSession();
  const canManageProperties = session.role === "ADMIN";

  return (
    <DashboardShell>
      <PageHeader
        action={<Building2 className="size-5 text-slate-400" />}
        title="املاک"
        description="مدیریت واقعی فایل‌های ملکی، قیمت‌گذاری، تخصیص مشاور، وضعیت انتشار، جستجو و فیلتر server-side."
      />
      <ResourceManager
        archivePayload={{ status: "PASSIVE" }}
        columns={[
          { key: "propertyCode", label: "کد" },
          { key: "title", label: "عنوان" },
          { key: "projectId.name", label: "پروژه" },
          { key: "city", label: "شهر" },
          { key: "district", label: "منطقه" },
          { key: "rooms", label: "اتاق" },
          { key: "grossArea", label: "متراژ" },
          { key: "price", label: "قیمت" },
          { key: "assignedAgentId.fullName", label: "مشاور" },
          { key: "status", label: "وضعیت" },
          { key: "createdAt", label: "تاریخ ثبت" },
        ]}
        canArchive={canManageProperties}
        canCreate={canManageProperties}
        canDelete={canManageProperties}
        canEdit={canManageProperties}
        detailBasePath="/properties"
        endpoint="/api/properties"
        fields={[
          { label: "عنوان", name: "title", required: true, section: "اطلاعات اصلی" },
          { label: "کد ملک", name: "propertyCode", required: true, section: "اطلاعات اصلی" },
          { label: "نوع معامله", name: "transactionType", options: transactionOptions, required: true, section: "اطلاعات اصلی", type: "select" },
          { label: "نوع ملک", name: "propertyType", options: propertyTypeOptions, required: true, section: "اطلاعات اصلی", type: "select" },
          { label: "وضعیت", name: "status", options: propertyStatusOptions, section: "اطلاعات اصلی", type: "select" },
          { label: "توضیحات", name: "description", section: "اطلاعات اصلی", type: "textarea" },
          { label: "شهر", name: "city", required: true, section: "موقعیت" },
          { label: "منطقه", name: "district", section: "موقعیت" },
          { label: "محله", name: "neighborhood", section: "موقعیت" },
          { label: "اتاق", name: "rooms", section: "مشخصات", type: "number" },
          { label: "حمام", name: "bathrooms", section: "مشخصات", type: "number" },
          { label: "متراژ ناخالص", name: "grossArea", required: true, section: "مشخصات", type: "number" },
          { label: "متراژ خالص", name: "netArea", section: "مشخصات", type: "number" },
          { label: "طبقه", name: "floor", section: "مشخصات", type: "number" },
          { label: "کل طبقات", name: "totalFloors", section: "مشخصات", type: "number" },
          { label: "سن بنا", name: "buildingAge", section: "مشخصات", type: "number" },
          { label: "قیمت", name: "price", required: true, section: "قیمت", type: "number" },
          { label: "ارز", name: "currency", options: currencyOptions, section: "قیمت", type: "select" },
          { label: "پروژه", name: "projectId", optionEndpoint: "/api/projects", optionLabel: "name", section: "ارتباطات", type: "select" },
          { label: "مشاور", name: "assignedAgentId", optionEndpoint: "/api/agents", optionLabel: "fullName", section: "ارتباطات", type: "select" },
          { label: "بالکن", name: "balcony", section: "امکانات", type: "checkbox" },
          { label: "پارکینگ", name: "parking", section: "امکانات", type: "checkbox" },
          { label: "استخر", name: "pool", section: "امکانات", type: "checkbox" },
          { label: "مبله", name: "furnished", section: "امکانات", type: "checkbox" },
          { label: "مناسب شهروندی", name: "citizenshipSuitable", section: "امکانات", type: "checkbox" },
          { label: "مناسب اقامت", name: "residencePermitSuitable", section: "امکانات", type: "checkbox" },
          { label: "امکانات اجتماعی (با کاما)", name: "socialFacilities", section: "امکانات" },
          { label: "تصاویر ملک", name: "images", section: "رسانه", type: "image-upload" },
          { label: "ویدیوی ملک", name: "videoUrl", section: "رسانه", type: "video-upload" },
        ]}
        filters={[
          { label: "شهر", name: "city" },
          { label: "منطقه", name: "district" },
          { label: "نوع معامله", name: "transactionType", options: transactionOptions, type: "select" },
          { label: "نوع ملک", name: "propertyType", options: propertyTypeOptions, type: "select" },
          { label: "اتاق", name: "rooms", type: "number" },
          { label: "حداقل قیمت", name: "minPrice", type: "number" },
          { label: "حداکثر قیمت", name: "maxPrice", type: "number" },
          ...(canManageProperties ? [{ label: "وضعیت", name: "status", options: propertyStatusOptions, type: "select" as const }] : []),
        ]}
        primaryLabel="ملک"
      />
    </DashboardShell>
  );
}
