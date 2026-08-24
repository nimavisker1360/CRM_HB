import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getTurkeyDistricts, getTurkeyNeighborhoods, getTurkeyProvinces, normalizeTurkeyLocationName } from "@/lib/turkey-locations";

describe("Turkey location data", () => {
  it("contains all 81 Turkish provinces", () => {
    expect(getTurkeyProvinces()).toHaveLength(81);
    expect(getTurkeyProvinces().some((item) => item.value === "İstanbul")).toBe(true);
  });

  it("resolves legacy ASCII province and district names", () => {
    expect(getTurkeyDistricts("Istanbul").some((item) => item.value === "Bağcılar")).toBe(true);
    expect(getTurkeyNeighborhoods("Istanbul", "Bagcilar").length).toBeGreaterThan(0);
  });

  it("normalizes Turkish characters consistently", () => {
    expect(normalizeTurkeyLocationName("Bağcılar")).toBe(normalizeTurkeyLocationName("Bagcilar"));
  });
});
