import { FileUp } from "lucide-react";
import { redirect } from "next/navigation";
import { ImportCenterClient } from "@/components/import/ImportCenterClient";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ImportCenterPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");

  return (
    <DashboardShell>
      <PageHeader
        action={<FileUp className="size-5 text-slate-400" />}
        title="مرکز ورود اطلاعات"
        description="ورود گروهی اطلاعات املاک، مشتریان و پروژه ها از CSV و Excel با نگاشت ستون، اعتبارسنجی، تشخیص تکراری و گزارش خطا."
      />
      <ImportCenterClient />
    </DashboardShell>
  );
}
