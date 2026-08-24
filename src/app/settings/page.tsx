import { AccessDenied } from "@/components/layout/AccessDenied";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { WhatsAppSettingsCard } from "@/components/whatsapp/WhatsAppSettingsCard";
import { requireSession } from "@/lib/auth/session";
import { getPublicWhatsAppConfiguration } from "@/services/whatsapp/whatsapp.service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    return <DashboardShell><AccessDenied message="تنظیمات اتصال WhatsApp فقط برای مدیر سیستم قابل دسترسی است." /></DashboardShell>;
  }
  return (
    <DashboardShell><PageHeader title="تنظیمات" description="اتصال‌ها و تنظیمات امن فضای کاری." /><div className="space-y-5 p-6"><WhatsAppSettingsCard config={getPublicWhatsAppConfiguration()} /></div></DashboardShell>
  );
}
