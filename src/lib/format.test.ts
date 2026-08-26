import { describe, expect, it } from "vitest";
import { formatGregorianDate, formatGregorianDateTime, formatGregorianTime } from "@/lib/format";

describe("Gregorian CRM date formatting", () => {
  it("uses the Gregorian year instead of the Persian/Jalali year", () => {
    const formatted = formatGregorianDate("2026-08-20T13:30:00.000Z");
    expect(formatted).toContain("2026");
    expect(formatted).not.toContain("1405");
  });

  it("formats date-time in the Europe/Istanbul time zone", () => {
    const formatted = formatGregorianDateTime("2026-08-20T13:30:00.000Z");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("16:30");
  });

  it("formats time-only values in the Europe/Istanbul time zone", () => {
    expect(formatGregorianTime("2026-08-20T13:30:00.000Z")).toBe("16:30");
  });

  it("uses Turkish date labels when Turkish is selected", () => {
    const formatted = formatGregorianDateTime("2026-08-20T13:30:00.000Z", "tr");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("16:30");
    expect(formatted).not.toMatch(/[\u0600-\u06ff]/);
  });

  it("returns a safe placeholder for invalid values", () => {
    expect(formatGregorianDateTime("not-a-date")).toBe("-");
  });
});
