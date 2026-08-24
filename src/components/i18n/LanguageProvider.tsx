"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  dictionaries,
  LANGUAGE_COOKIE,
  localeDirection,
  type AppLocale,
} from "@/lib/i18n";

type LanguageContextValue = {
  locale: AppLocale;
  dictionary: (typeof dictionaries)[AppLocale];
  setLocale: (locale: AppLocale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: AppLocale }) {
  const router = useRouter();
  const [locale, setCurrentLocale] = useState(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => ({
    dictionary: dictionaries[locale],
    locale,
    setLocale(nextLocale) {
      if (nextLocale === locale) return;
      setCurrentLocale(nextLocale);
      document.cookie = `${LANGUAGE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = nextLocale;
      document.documentElement.dir = localeDirection(nextLocale);
      router.refresh();
    },
  }), [locale, router]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
