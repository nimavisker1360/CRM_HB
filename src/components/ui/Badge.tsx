"use client";

import clsx from "clsx";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { translateLiteral } from "@/lib/i18n";

const toneClass = {
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
} as const;

type BadgeProps = {
  children: React.ReactNode;
  tone?: keyof typeof toneClass;
};

export function Badge({ children, tone = "slate" }: BadgeProps) {
  const { locale } = useLanguage();
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium",
        toneClass[tone],
      )}
    >
      {typeof children === "string" ? translateLiteral(children, locale) : children}
    </span>
  );
}
