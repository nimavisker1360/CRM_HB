import { describe, expect, it } from "vitest";
import { translateLiteral } from "@/lib/i18n";

describe("Turkish dashboard literal translations", () => {
  it.each([
    ["مدیریت واقعی فایل‌های ملکی، قیمت‌گذاری، تخصیص مشاور، وضعیت انتشار، جستجو و فیلتر server-side.", "Gayrimenkul portföyünü, fiyatlandırmayı, danışman atamalarını, yayın durumunu, aramayı ve sunucu taraflı filtreleri yönetin."],
    ["حداقل قیمت", "Minimum fiyat"],
    ["حداکثر قیمت", "Maksimum fiyat"],
    ["ACTIVE", "Aktif"],
  ])("translates %s", (source, expected) => {
    expect(translateLiteral(source, "tr")).toBe(expected);
  });

  it("keeps Persian labels unchanged in Persian mode", () => {
    expect(translateLiteral("حداقل قیمت", "fa")).toBe("حداقل قیمت");
  });
});
