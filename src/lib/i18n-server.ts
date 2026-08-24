import "server-only";

import { cookies } from "next/headers";
import { isAppLocale, LANGUAGE_COOKIE, type AppLocale } from "@/lib/i18n";

export async function getServerLocale(): Promise<AppLocale> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return isAppLocale(value) ? value : "fa";
}
