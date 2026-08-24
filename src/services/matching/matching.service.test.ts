import { describe, expect, it } from "vitest";
import { buildPropertyCandidateQuery, isPropertyCandidateForCustomer } from "./matching.service";

describe("buildPropertyCandidateQuery", () => {
  it("filters candidates by district and the requested area range", () => {
    const query = buildPropertyCandidateQuery({
      interestedCity: "Istanbul",
      interestedDistrict: "Kadikoy",
      currency: "USD",
      maxArea: 200,
      maxBudget: 300_000,
      minArea: 150,
      propertyType: "APARTMENT",
      transactionType: "SALE",
    });

    expect(query).toMatchObject({
      city: "Istanbul",
      currency: "USD",
      district: "Kadikoy",
      grossArea: { $gte: 150, $lte: 200 },
      price: { $lte: 345_000 },
      propertyType: "APARTMENT",
      status: "ACTIVE",
      transactionType: "SALE",
    });
  });

  it("does not add room or amenity requirements to the hard filter", () => {
    const query = buildPropertyCandidateQuery({
      citizenshipInterest: true,
      minRooms: 3,
      residenceInterest: true,
    });

    expect(query).not.toHaveProperty("rooms");
    expect(query).not.toHaveProperty("citizenshipSuitable");
    expect(query).not.toHaveProperty("residencePermitSuitable");
  });

  it("rejects a 90 square meter property for a 150 to 200 square meter request", () => {
    expect(
      isPropertyCandidateForCustomer(
        {
          currency: "USD",
          interestedCity: "Istanbul",
          interestedDistrict: "Kadikoy",
          maxArea: 200,
          maxBudget: 300_000,
          minArea: 150,
          propertyType: "APARTMENT",
          transactionType: "SALE",
        },
        {
          currency: "USD",
          city: "Istanbul",
          district: "Kadikoy",
          grossArea: 90,
          price: 250_000,
          propertyType: "APARTMENT",
          status: "ACTIVE",
          transactionType: "SALE",
        },
      ),
    ).toBe(false);
  });

  it("does not reject a candidate because of rooms or amenities", () => {
    expect(
      isPropertyCandidateForCustomer(
        {
          citizenshipInterest: true,
          maxArea: 200,
          minArea: 150,
          minRooms: 4,
          residenceInterest: true,
        },
        {
          citizenshipSuitable: false,
          grossArea: 170,
          residencePermitSuitable: false,
          rooms: 1,
          status: "ACTIVE",
        },
      ),
    ).toBe(true);
  });
});
