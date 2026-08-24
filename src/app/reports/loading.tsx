import { DashboardShell } from "@/components/layout/DashboardShell";
import { getServerLocale } from "@/lib/i18n-server";

export default async function ReportsLoading() {
  const locale = await getServerLocale();
  return (
    <DashboardShell>
      <div className="animate-pulse space-y-6 p-6" aria-label={locale === "tr" ? "Rapor yükleniyor" : "در حال دریافت گزارش"}>
        <div className="h-20 rounded-xl bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div className="h-32 rounded-xl bg-slate-200" key={index} />)}</div>
        <div className="grid gap-5 xl:grid-cols-2"><div className="h-96 rounded-xl bg-slate-200" /><div className="h-96 rounded-xl bg-slate-200" /></div>
      </div>
    </DashboardShell>
  );
}
