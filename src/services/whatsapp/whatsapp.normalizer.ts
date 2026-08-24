export function normalizeWhatsAppPhone(value?: string | null) {
  const input = value?.trim();
  if (!input) return null;

  if (!/^\+?[\d\s().-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return digits;
}

export function displayWhatsAppPhone(value?: string | null) {
  const normalized = normalizeWhatsAppPhone(value);
  return normalized ? `+${normalized}` : value || "-";
}

export function phoneSearchPattern(normalized: string) {
  return normalized
    .slice(-8)
    .split("")
    .map((digit) => `${digit}[^0-9]*`)
    .join("");
}
