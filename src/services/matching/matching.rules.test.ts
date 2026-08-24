import { describe, expect, it } from "vitest";
import { MATCH_MIN_SCORE } from "./matching.config";
import { calculatePropertyMatch } from "./matching.rules";

const baseCustomer = {
  currency: "TRY",
  interestedCity: "Istanbul",
  interestedDistrict: "Bagcilar",
  maxBudget: 8_000_000,
  minArea: 150,
  minRooms: 3,
  propertyType: "APARTMENT",
  transactionType: "SALE",
};

const baseProperty = {
  city: "Istanbul",
  currency: "TRY",
  district: "Bagcilar",
  grossArea: 177,
  price: 7_500_000,
  propertyType: "APARTMENT",
  rooms: 3,
  status: "ACTIVE",
  transactionType: "SALE",
};

describe("calculatePropertyMatch", () => {
  it("returns 100 for a perfect match", () => {
    const result = calculatePropertyMatch(baseCustomer, baseProperty);
    expect(result.score).toBe(100);
    expect(result.breakdown.budget.score).toBe(30);
    expect(result.breakdown.location.score).toBe(25);
  });

  it("reduces budget score when price is slightly above max budget", () => {
    const result = calculatePropertyMatch(baseCustomer, { ...baseProperty, price: 8_300_000 });
    expect(result.budgetScore).toBe(24);
    expect(result.score).toBeLessThan(100);
  });

  it("scores different district in the same city lower than exact location", () => {
    const result = calculatePropertyMatch(baseCustomer, { ...baseProperty, district: "Kadikoy" });
    expect(result.locationScore).toBe(15);
    expect(result.score).toBeLessThan(100);
  });

  it("returns zero location score for the wrong city", () => {
    const result = calculatePropertyMatch(baseCustomer, { ...baseProperty, city: "Ankara" });
    expect(result.locationScore).toBe(0);
  });

  it("matches Turkish locations despite casing and diacritic differences", () => {
    const result = calculatePropertyMatch(
      { ...baseCustomer, interestedCity: "İstanbul", interestedDistrict: "Bağcılar" },
      { ...baseProperty, city: "istanbul", district: "bagcilar" },
    );

    expect(result.locationScore).toBe(25);
    expect(result.score).toBe(100);
  });

  it("normalizes score when budget is missing", () => {
    const { maxBudget, ...customerWithoutBudget } = baseCustomer;
    expect(maxBudget).toBe(8_000_000);
    const result = calculatePropertyMatch(customerWithoutBudget, baseProperty);
    expect(result.breakdown.budget.evaluated).toBe(false);
    expect(result.score).toBe(100);
  });

  it("removes property type weight when customer did not specify it", () => {
    const { propertyType, ...customerWithoutType } = baseCustomer;
    expect(propertyType).toBe("APARTMENT");
    const result = calculatePropertyMatch(customerWithoutType, baseProperty);
    expect(result.breakdown.propertyType.evaluated).toBe(false);
    expect(result.score).toBe(100);
  });

  it("excludes budget from denominator when currency differs", () => {
    const result = calculatePropertyMatch(baseCustomer, { ...baseProperty, currency: "USD" });
    expect(result.breakdown.budget.evaluated).toBe(false);
    expect(result.mismatches).toContain("Currency differs and cannot be compared automatically");
    expect(result.score).toBe(100);
  });

  it("keeps special requirement score before max weight", () => {
    const result = calculatePropertyMatch(
      { ...baseCustomer, citizenshipInterest: true },
      { ...baseProperty, citizenshipSuitable: false },
    );
    expect(result.breakdown.specialRequirements.evaluated).toBe(true);
    expect(result.breakdown.specialRequirements.score).toBe(0);
    expect(result.breakdown.specialRequirements.max).toBe(10);
  });

  it("can produce a score below the minimum save threshold", () => {
    const result = calculatePropertyMatch(baseCustomer, {
      ...baseProperty,
      city: "Ankara",
      grossArea: 90,
      price: 10_000_000,
      propertyType: "VILLA",
      rooms: 1,
    });
    expect(result.score).toBeLessThan(MATCH_MIN_SCORE);
  });
});
