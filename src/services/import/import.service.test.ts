import { describe, expect, it } from "vitest";
import { suggestImportMapping } from "@/services/import/import-mapper";
import { normalizeImportRecord, normalizePhone } from "@/services/import/import-normalizer";
import { parseImportFile } from "@/services/import/import-parser";

describe("import parser", () => {
  it("parses quoted CSV values and semicolon delimiters", () => {
    const parsed = parseImportFile({
      buffer: Buffer.from("Name;Phone;Budget\n\"Ali, Veli\";+90 555 111 22 33;7.500.000"),
      fileName: "customers.csv",
      fileSize: 64,
      fileType: "text/csv",
    });

    expect(parsed.headers).toEqual(["Name", "Phone", "Budget"]);
    expect(parsed.rows[0].values.Name).toBe("Ali, Veli");
    expect(parsed.rows[0].values.Budget).toBe("7.500.000");
  });

  it("detects duplicate headers", () => {
    const parsed = parseImportFile({
      buffer: Buffer.from("Phone,Phone\n1,2"),
      fileName: "customers.csv",
      fileSize: 16,
      fileType: "text/csv",
    });

    expect(parsed.duplicateHeaders).toEqual(["Phone"]);
  });
});

describe("import mapping", () => {
  it("maps common Turkish customer headers", () => {
    const mapping = suggestImportMapping("CUSTOMERS", ["Ad Soyad", "Telefon", "Bütçe", "Şehir", "İlçe"]);

    expect(mapping["Ad Soyad"]).toBe("fullName");
    expect(mapping.Telefon).toBe("phone");
    expect(mapping["Bütçe"]).toBe("maxBudget");
    expect(mapping["Şehir"]).toBe("interestedCity");
    expect(mapping["İlçe"]).toBe("interestedDistrict");
  });
});

describe("import normalization", () => {
  it("normalizes numbers, currency, booleans, transaction type, and rooms", () => {
    const result = normalizeImportRecord(
      {
        balcony: "evet",
        currency: "₺",
        price: "7 500 000",
        rooms: "3+1",
        transactionType: "Satılık",
      },
      2,
    );

    expect(result.normalized.balcony).toBe(true);
    expect(result.normalized.currency).toBe("TRY");
    expect(result.normalized.price).toBe(7_500_000);
    expect(result.normalized.rooms).toBe(3);
    expect(result.normalized.transactionType).toBe("SALE");
    expect(result.warnings.some((warning) => warning.field === "rooms")).toBe(true);
  });

  it("normalizes Turkish phone numbers without guessing unknown countries", () => {
    expect(normalizePhone("+90 555 111 22 33")).toBe("+905551112233");
    expect(normalizePhone("05551112233")).toBe("+905551112233");
    expect(normalizePhone("5551112233")).toBe("5551112233");
  });
});
