"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { AppLocale } from "@/lib/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { dictionary, locale, setLocale } = useLanguage();
  const options: Array<{ label: string; value: AppLocale }> = [
    { label: "فارسی", value: "fa" },
    { label: "Türkçe", value: "tr" },
  ];

  return (
    <div
      aria-label={dictionary.shell.changeLanguage}
      className="language-switcher inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/7 p-1"
      dir="ltr"
      role="group"
    >
      {!compact ? <Languages className="mx-1 size-4 text-white/55" aria-hidden="true" /> : null}
      {options.map((option) => (
        <button
          aria-pressed={locale === option.value}
          className={locale === option.value ? "is-active" : undefined}
          key={option.value}
          onClick={() => setLocale(option.value)}
          type="button"
        >
          {compact ? (option.value === "fa" ? "فا" : "TR") : option.label}
        </button>
      ))}
    </div>
  );
}
