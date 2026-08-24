import type { ImportRowIssue } from "@/services/import/import.types";

const BOOLEAN_FIELDS = new Set([
  "balcony",
  "citizenshipInterest",
  "citizenshipSuitable",
  "furnished",
  "investmentInterest",
  "parking",
  "pool",
  "residenceInterest",
  "residencePermitSuitable",
  "residenceSuitable",
]);

const NUMBER_FIELDS = new Set([
  "bathrooms",
  "buildingAge",
  "floor",
  "grossArea",
  "maxArea",
  "maxBudget",
  "maxRooms",
  "minArea",
  "minBudget",
  "minRooms",
  "netArea",
  "price",
  "rooms",
  "totalFloors",
]);

const ARRAY_FIELDS = new Set(["facilities", "images", "documents", "preferredCities", "socialFacilities", "tags"]);
const DATE_FIELDS = new Set(["deliveryDate", "lastContact", "nextFollowUp"]);

export function normalizeImportRecord(record: Record<string, string>, rowNumber: number) {
  const warnings: ImportRowIssue[] = [];
  const normalized: Record<string, unknown> = {};

  for (const [field, rawValue] of Object.entries(record)) {
    const value = normalizeString(rawValue);
    if (value === "") continue;

    if (BOOLEAN_FIELDS.has(field)) {
      const booleanValue = parseBoolean(value);
      if (booleanValue === undefined) {
        warnings.push({ field, message: "Boolean value is ambiguous.", row: rowNumber, value });
        continue;
      }
      normalized[field] = booleanValue;
      continue;
    }

    if (NUMBER_FIELDS.has(field)) {
      const numberValue = field.toLocaleLowerCase("en-US").includes("rooms") ? parseRooms(value) : parseNumber(value);
      if (numberValue === undefined) {
        warnings.push({ field, message: "Number value is ambiguous.", row: rowNumber, value });
        continue;
      }
      if (field === "rooms" && /\d+\s*\+\s*\d+/.test(value)) {
        warnings.push({ field, message: "Rooms value was normalized without adding living-room notation.", row: rowNumber, value });
      }
      normalized[field] = numberValue;
      continue;
    }

    if (ARRAY_FIELDS.has(field)) {
      normalized[field] = value
        .split(/[,;|]/)
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }

    if (DATE_FIELDS.has(field)) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        warnings.push({ field, message: "Date value is invalid.", row: rowNumber, value });
        continue;
      }
      normalized[field] = date;
      continue;
    }

    if (field === "currency") {
      normalized[field] = normalizeCurrency(value) || value.toUpperCase();
      continue;
    }

    if (field === "transactionType") {
      normalized[field] = normalizeTransactionType(value) || value.toUpperCase();
      continue;
    }

    if (field === "status") {
      normalized[field] = normalizeStatus(value) || value.toUpperCase();
      continue;
    }

    if (field === "propertyType") {
      normalized[field] = normalizePropertyType(value) || value.toUpperCase();
      continue;
    }

    if (field === "phone" || field === "whatsapp") {
      normalized[field] = normalizePhone(value);
      continue;
    }

    if (field === "email" || field === "assignedAgentEmail") {
      normalized[field] = value.toLocaleLowerCase("en-US");
      continue;
    }

    normalized[field] = value;
  }

  return { normalized, warnings };
}

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  const startsWithPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  if (startsWithPlus) return `+${digits}`;
  if (/^0\d{10}$/.test(digits)) return `+90${digits.slice(1)}`;
  if (/^90\d{10}$/.test(digits)) return `+${digits}`;
  return digits;
}

export function normalizeComparisonValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");
}

export function csvSafe(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function normalizeString(value: string) {
  return value.replace(/\u0000/g, "").trim();
}

function parseBoolean(value: string) {
  const normalized = normalizeComparisonValue(value);
  if (["1", "true", "yes", "y", "evet", "var", "بله"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "hayir", "hayır", "yok", "خیر"].includes(normalized)) return false;
  return undefined;
}

function parseNumber(value: string) {
  const compact = value.replace(/\s/g, "");
  if (!compact) return undefined;

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized = compact.replace(/[^0-9,.-]/g, "");

  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = normalized.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
  } else if ((normalized.match(/,/g) || []).length > 1) {
    normalized = normalized.replaceAll(",", "");
  } else if ((normalized.match(/\./g) || []).length > 1) {
    normalized = normalized.replaceAll(".", "");
  } else if (/^\d{1,3}([,.])\d{3}$/.test(normalized)) {
    normalized = normalized.replace(/[,.]/g, "");
  } else {
    normalized = normalized.replace(",", ".");
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}

function parseRooms(value: string) {
  const match = value.match(/\d+/);
  if (!match) return undefined;
  return Number(match[0]);
}

function normalizeCurrency(value: string) {
  const normalized = normalizeComparisonValue(value);
  if (["tl", "try", "₺", "turkish lira", "lira"].includes(normalized)) return "TRY";
  if (["$", "usd", "dollar", "dolar"].includes(normalized)) return "USD";
  if (["€", "eur", "euro"].includes(normalized)) return "EUR";
  if (["£", "gbp", "pound"].includes(normalized)) return "GBP";
  return undefined;
}

function normalizeTransactionType(value: string) {
  const normalized = normalizeComparisonValue(value);
  if (["sale", "for sale", "satilik", "satılık", "فروش"].includes(normalized)) return "SALE";
  if (["rent", "rental", "kiralik", "kiralık", "اجاره"].includes(normalized)) return "RENT";
  return undefined;
}

function normalizeStatus(value: string) {
  const normalized = normalizeComparisonValue(value);
  if (["active", "available", "aktif", "موجود", "فعال"].includes(normalized)) return "ACTIVE";
  if (["reserved", "rezerv", "رزرو"].includes(normalized)) return "RESERVED";
  if (["sold", "فروخته"].includes(normalized)) return "SOLD";
  if (["rented", "اجاره رفت"].includes(normalized)) return "RENTED";
  if (["passive", "inactive", "غیرفعال"].includes(normalized)) return "PASSIVE";
  if (["planned", "plan"].includes(normalized)) return "PLANNED";
  if (["delivered", "تحویل"].includes(normalized)) return "DELIVERED";
  if (["archived", "archive", "آرشیو"].includes(normalized)) return "ARCHIVED";
  if (["new", "new lead", "lead", "سرنخ"].includes(normalized)) return "NEW_LEAD";
  return undefined;
}

function normalizePropertyType(value: string) {
  const normalized = normalizeComparisonValue(value);
  if (["apartment", "flat", "daire", "آپارتمان"].includes(normalized)) return "APARTMENT";
  if (["villa", "ویلا"].includes(normalized)) return "VILLA";
  if (["land", "arsa", "زمین"].includes(normalized)) return "LAND";
  if (["commercial", "تجاری"].includes(normalized)) return "COMMERCIAL";
  if (["office", "اداری"].includes(normalized)) return "OFFICE";
  if (["shop", "مغازه"].includes(normalized)) return "SHOP";
  return undefined;
}
