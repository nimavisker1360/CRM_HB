type PreviewCustomer = { fullName?: unknown };
type PreviewProperty = {
  city?: unknown;
  currency?: unknown;
  district?: unknown;
  grossArea?: unknown;
  price?: unknown;
  rooms?: unknown;
  title?: unknown;
};
type PreviewAgent = { fullName?: unknown; name?: unknown };

export const WHATSAPP_TEMPLATE_PURPOSES = [
  "PROPERTY_RECOMMENDATION",
  "FOLLOWUP_REMINDER",
  "MEETING_CONFIRMATION",
  "NEW_PROPERTY",
  "GENERAL_CONTACT",
] as const;

function value(input: unknown, fallback = "-") {
  return input === undefined || input === null || input === "" ? fallback : String(input);
}

function money(amount: unknown, currency: unknown) {
  const numeric = Number(amount);
  return Number.isFinite(numeric) ? `${new Intl.NumberFormat("tr-TR").format(numeric)} ${value(currency, "TRY")}` : "-";
}

export function buildPropertyPreview(customer: PreviewCustomer, property: PreviewProperty, agent?: PreviewAgent) {
  return [
    `Merhaba ${value(customer.fullName)},`,
    "",
    "Size uygun olabileceğini düşündüğümüz bir portföyümüz var:",
    "",
    `${value(property.title)} ${property.rooms ? `${value(property.rooms)} oda` : ""}`.trim(),
    property.grossArea ? `${value(property.grossArea)} m²` : "",
    money(property.price, property.currency),
    [property.city, property.district].filter(Boolean).map(String).join(" / "),
    "",
    value(agent?.fullName || agent?.name, "HB Real Estate"),
    "HB Real Estate",
  ].filter((line, index, lines) => line !== "" || (index > 0 && lines[index - 1] !== "")).join("\n");
}

export function buildMatchPreview(
  customer: PreviewCustomer,
  property: PreviewProperty,
  score: unknown,
  agent?: PreviewAgent,
) {
  return [
    `Merhaba ${value(customer.fullName)},`,
    "",
    "Sizin için uygun olabilecek yeni bir portföy bulduk.",
    "",
    value(property.title),
    money(property.price, property.currency),
    property.grossArea ? `${value(property.grossArea)} m²` : "",
    `Eşleşme: %${value(score, "0")}`,
    "",
    "Detayları incelemek isterseniz size yardımcı olabilirim.",
    "",
    value(agent?.fullName || agent?.name, "HB Real Estate"),
    "HB Real Estate",
  ].filter((line, index, lines) => line !== "" || (index > 0 && lines[index - 1] !== "")).join("\n");
}

export function buildFollowUpPreview(customer: PreviewCustomer, note?: unknown, agent?: PreviewAgent) {
  return [
    `Merhaba ${value(customer.fullName)},`,
    "",
    value(note, "Gayrimenkul talebiniz hakkında sizinle tekrar iletişime geçmek istedik."),
    "",
    value(agent?.fullName || agent?.name, "HB Real Estate"),
    "HB Real Estate",
  ].join("\n");
}
