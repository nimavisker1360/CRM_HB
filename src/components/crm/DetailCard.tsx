import { formatGregorianDateTime } from "@/lib/format";
import { getServerLocale } from "@/lib/i18n-server";
import { translateLiteral, type AppLocale } from "@/lib/i18n";

type DetailCardProps = {
  items: Array<[string, unknown]>;
  title: string;
};

function isPhoneLabel(label: string) {
  return label === "واتساپ" || label === "تلفن" || label === "WhatsApp" || label === "Telefon";
}

function display(value: unknown, locale: AppLocale) {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? (locale === "tr" ? "Evet" : "بله") : (locale === "tr" ? "Hayır" : "خیر");
  if (typeof value === "number") return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "fa-IR-u-nu-latn").format(value);
  if (Array.isArray(value)) return value.map((item) => translateLiteral(String(item), locale)).join("، ");
  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return String(objectValue.fullName || objectValue.name || objectValue.title || objectValue._id || "-");
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) {
    return formatGregorianDateTime(value, locale);
  }
  return translateLiteral(String(value), locale);
}

export async function DetailCard({ items, title }: DetailCardProps) {
  const locale = await getServerLocale();
  return (
    <section className="app-card p-5 sm:p-6">
      <h2 className="mb-5 font-extrabold text-slate-950">{translateLiteral(title, locale)}</h2>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, value]) => (
          <div className="rounded-xl bg-slate-50/80 p-3" key={label}>
            <dt className="text-xs font-semibold text-slate-500">{translateLiteral(label, locale)}</dt>
            <dd
              className={`mt-1.5 text-sm font-bold text-slate-800 ${isPhoneLabel(label) ? "text-left" : ""}`}
              dir={isPhoneLabel(label) ? "ltr" : undefined}
            >
              {display(value, locale)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
