import { ArrowRight, type LucideIcon } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { getServerLocale } from "@/lib/i18n-server";
import { translateLiteral } from "@/lib/i18n";

type SectionPageProps = {
  description: string;
  icon: LucideIcon;
  items: string[];
  title: string;
};

export async function SectionPage({
  description,
  icon: Icon,
  items,
  title,
}: SectionPageProps) {
  const locale = await getServerLocale();
  return (
    <DashboardShell>
      <PageHeader title={title} description={description} />
      <div className="mx-auto max-w-[1540px] p-4 sm:p-7">
        <div className="app-card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-slate-950">{translateLiteral("محدوده فاز اول", locale)}</p>
              <p className="text-sm text-slate-500">
                {translateLiteral("مدل داده و مسیر دسترسی این بخش آماده شده است.", locale)}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div
                key={item}
                className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <span>{translateLiteral(item, locale)}</span>
                <ArrowRight className="size-4 shrink-0 text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
