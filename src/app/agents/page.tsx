import { UserRoundCog } from "lucide-react";
import { redirect } from "next/navigation";
import { ResourceManager, type FieldOption } from "@/components/crm/ResourceManager";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const roleOptions: FieldOption[] = [
  { label: "مدیر کل", value: "ADMIN" },
  { label: "مدیر", value: "MANAGER" },
  { label: "مشاور", value: "AGENT" },
];

const statusOptions: FieldOption[] = [
  { label: "دعوت‌شده", value: "INVITED" },
  { label: "فعال", value: "ACTIVE" },
  { label: "تعلیق‌شده", value: "SUSPENDED" },
];

export default async function AgentsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashboardShell>
      <PageHeader action={<UserRoundCog className="size-5 text-slate-400" />} title="مشاوران" description="مدیریت تیم، نقش‌ها، حساب‌های کاربری متصل، وضعیت و دسترسی به پنل مشاور." />
      <ResourceManager
        activationPayload={{ status: "ACTIVE", isActive: true }}
        archivePayload={{ status: "SUSPENDED", isActive: false }}
        canArchive={false}
        canDelete
        canPermanentlyDelete
        columns={[
          { key: "avatarDataUrl", label: "عکس" },
          { key: "fullName", label: "نام" },
          { key: "email", label: "ایمیل" },
          { key: "phone", label: "تلفن" },
          { key: "role", label: "نقش" },
          { key: "status", label: "وضعیت" },
          { key: "createdAt", label: "تاریخ ثبت" },
        ]}
        detailBasePath="/agents"
        deleteConfirmationField="fullName"
        endpoint="/api/agents"
        fields={[
          { label: "نام کامل", name: "fullName", required: true, section: "حساب کاربری" },
          { label: "ایمیل", name: "email", required: true, section: "حساب کاربری" },
          { label: "رمز عبور", name: "password", section: "حساب کاربری" },
          { label: "تلفن", name: "phone", section: "حساب کاربری" },
          { label: "نقش", name: "role", options: roleOptions, section: "دسترسی", type: "select" },
          { label: "وضعیت", name: "status", options: statusOptions, section: "دسترسی", type: "select" },
          { label: "فعال", name: "isActive", section: "دسترسی", type: "checkbox" },
        ]}
        filters={[
          { label: "نقش", name: "role", options: roleOptions, type: "select" },
          { label: "وضعیت", name: "status", options: statusOptions, type: "select" },
        ]}
        imageUpload={{ field: "avatarDataUrl", path: "avatar" }}
        primaryLabel="مشاور"
        workspaceBasePath="/agents"
      />
    </DashboardShell>
  );
}
