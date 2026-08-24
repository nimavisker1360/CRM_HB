import { describe, expect, it } from "vitest";
import { localizeActivity } from "@/lib/activity-i18n";

describe("activity localization", () => {
  it("localizes legacy agent updates in Persian", () => {
    expect(localizeActivity({
      action: "UPDATED",
      description: "Admin HB updated agent NIMA BAGHERI TONKABONI.",
    }, "fa")).toEqual({
      kind: "updated",
      text: "Admin HB، اطلاعات مشاور NIMA BAGHERI TONKABONI را به‌روزرسانی کرد",
    });
  });

  it("localizes legacy agent updates in Turkish", () => {
    expect(localizeActivity({
      action: "UPDATED",
      description: "Admin HB updated agent NIMA BAGHERI TONKABONI.",
    }, "tr")).toEqual({
      kind: "updated",
      text: "Admin HB, NIMA BAGHERI TONKABONI adlı danışmanın bilgilerini güncelledi",
    });
  });

  it("distinguishes avatar updates through structured metadata", () => {
    expect(localizeActivity({
      action: "UPDATED",
      metadata: {
        activityKey: "AGENT_AVATAR_UPDATED",
        actorName: "Admin HB",
        subjectName: "NIMA BAGHERI TONKABONI",
      },
    }, "fa")).toEqual({
      kind: "avatar",
      text: "Admin HB، عکس پروفایل مشاور NIMA BAGHERI TONKABONI را به‌روزرسانی کرد",
    });
  });

  it("never exposes an unknown English description as the localized fallback", () => {
    expect(localizeActivity({ action: "CREATED", description: "Unrecognized English text." }, "tr").text)
      .toBe("Yeni bir kayıt oluşturuldu");
  });
});
