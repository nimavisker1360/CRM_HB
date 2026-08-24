"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { translateLiteral } from "@/lib/i18n";

type PageHeaderProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function PageHeader({ action, description, title }: PageHeaderProps) {
  const { dictionary, locale } = useLanguage();

  return (
    <header className="page-header relative overflow-hidden px-4 py-6 sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute -end-20 -top-24 size-52 rounded-full bg-sky-200/35 blur-3xl" />
      <div className="relative mx-auto flex max-w-[1540px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">{dictionary.shell.pageEyebrow}</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-[28px]">{translateLiteral(title, locale)}</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">{translateLiteral(description, locale)}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
