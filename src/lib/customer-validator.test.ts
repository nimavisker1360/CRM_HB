import { describe, expect, it } from "vitest";
import { customerSchema } from "@/lib/validators";

describe("customer WhatsApp validation", () => {
  it("uses WhatsApp as the required primary customer number", () => {
    const parsed = customerSchema.parse({
      fullName: "Nima Bagheri",
      whatsapp: "+90 552 607 89 00",
    });

    expect(parsed.phone).toBeUndefined();
    expect(parsed.whatsapp).toBe("+905526078900");
  });

  it("rejects a local number without an explicit country code", () => {
    const result = customerSchema.safeParse({
      fullName: "Nima Bagheri",
      whatsapp: "05526078900",
    });

    expect(result.success).toBe(false);
  });
});
