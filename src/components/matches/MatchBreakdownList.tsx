type BreakdownItem = {
  evaluated?: boolean;
  max?: number;
  score?: number;
};

const labels = {
  area: "Area",
  budget: "Budget",
  location: "Location",
  propertyType: "Property type",
  rooms: "Rooms",
  specialRequirements: "Special",
} as const;

export async function MatchBreakdownList({
  breakdown,
}: {
  breakdown?: Partial<Record<keyof typeof labels, BreakdownItem>>;
}) {
  const locale = await getServerLocale();
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {Object.entries(labels).map(([key, label]) => {
        const item = breakdown?.[key as keyof typeof labels];
        return (
          <div className="rounded-md border border-slate-200 p-3 text-sm" key={key}>
            <p className="font-medium text-slate-700">{translateLiteral(label, locale)}</p>
            <p className="mt-1 text-slate-500">
              {item?.evaluated ? (
                <span className="inline-block" dir="ltr">
                  {item.score ?? 0} / {item.max ?? 0}
                </span>
              ) : (
                translateLiteral("Not evaluated", locale)
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
import { getServerLocale } from "@/lib/i18n-server";
import { translateLiteral } from "@/lib/i18n";
