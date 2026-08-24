import { ShieldAlert } from "lucide-react";
import { getServerLocale } from "@/lib/i18n-server";
import { translateLiteral } from "@/lib/i18n";

export async function AccessDenied({ message = "شما به این پنل یا رکورد دسترسی ندارید." }: { message?: string }) {
  const locale = await getServerLocale();
  return (
    <div className="mx-auto max-w-[1540px] p-4 sm:p-7">
      <div className="app-card flex items-start gap-4 border-red-100 bg-red-50/80 p-5 text-sm text-red-800">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><ShieldAlert className="size-5" /></span>
        <div><p className="font-extrabold">{translateLiteral("۴۰۳ - دسترسی غیرمجاز", locale)}</p><p className="mt-1 leading-6">{translateLiteral(message, locale)}</p></div>
      </div>
    </div>
  );
}
