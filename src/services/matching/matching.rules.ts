import { MATCHING_VERSION, MATCH_WEIGHTS } from "@/services/matching/matching.config";
import type {
  MatchBreakdown,
  MatchCalculationResult,
  MatchCriterionKey,
  MatchCustomerInput,
  MatchPropertyInput,
} from "@/services/matching/matching.types";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: unknown) {
  return asString(value).toLowerCase();
}

function normalizedLocation(value: unknown) {
  return asString(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ı", "i")
    .toLowerCase();
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown) {
  return value === true;
}

export function parseRooms(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = asString(value);
  if (!text) return undefined;
  const plusMatch = text.match(/^(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)/);
  if (plusMatch) return Number(plusMatch[1]);
  const numeric = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function emptyBreakdown(): MatchBreakdown {
  return {
    area: { evaluated: false, max: MATCH_WEIGHTS.area, score: 0 },
    budget: { evaluated: false, max: MATCH_WEIGHTS.budget, score: 0 },
    location: { evaluated: false, max: MATCH_WEIGHTS.location, score: 0 },
    propertyType: { evaluated: false, max: MATCH_WEIGHTS.propertyType, score: 0 },
    rooms: { evaluated: false, max: MATCH_WEIGHTS.rooms, score: 0 },
    specialRequirements: {
      evaluated: false,
      max: MATCH_WEIGHTS.specialRequirements,
      score: 0,
    },
  };
}

function setScore(
  breakdown: MatchBreakdown,
  key: MatchCriterionKey,
  score: number | undefined,
) {
  if (score === undefined) return;
  breakdown[key] = {
    evaluated: true,
    max: MATCH_WEIGHTS[key],
    score: Math.max(0, Math.min(score, MATCH_WEIGHTS[key])),
  };
}

function scoreBudget(customer: MatchCustomerInput, property: MatchPropertyInput) {
  const maxBudget = asNumber(customer.maxBudget) ?? asNumber(customer.budgetMax);
  const minBudget = asNumber(customer.minBudget) ?? asNumber(customer.budgetMin);
  const price = asNumber(property.price);
  const customerCurrency = asString(customer.currency);
  const propertyCurrency = asString(property.currency);
  const reasons: string[] = [];
  const mismatches: string[] = [];

  if (!maxBudget || !price) return { mismatches, reasons, score: undefined };

  if (customerCurrency && propertyCurrency && customerCurrency !== propertyCurrency) {
    mismatches.push("Currency differs and cannot be compared automatically");
    return { mismatches, reasons, score: undefined };
  }

  if (minBudget && price < minBudget) {
    reasons.push("Property price is below customer minimum budget");
    return { mismatches, reasons, score: MATCH_WEIGHTS.budget };
  }

  if (price <= maxBudget) {
    reasons.push("Price is within customer budget");
    return { mismatches, reasons, score: MATCH_WEIGHTS.budget };
  }

  const overBudgetRatio = (price - maxBudget) / maxBudget;
  if (overBudgetRatio <= 0.05) {
    mismatches.push("Property price is up to 5% above customer budget");
    return { mismatches, reasons, score: 24 };
  }

  if (overBudgetRatio <= 0.1) {
    mismatches.push("Property price is up to 10% above customer budget");
    return { mismatches, reasons, score: 15 };
  }

  mismatches.push("Property price is more than 10% above customer budget");
  return { mismatches, reasons, score: 0 };
}

function scoreLocation(customer: MatchCustomerInput, property: MatchPropertyInput) {
  const customerCity = normalizedLocation(customer.interestedCity);
  const customerDistrict = normalizedLocation(customer.interestedDistrict);
  const customerNeighborhood = normalizedLocation(customer.neighborhood);
  const propertyCity = normalizedLocation(property.city);
  const propertyDistrict = normalizedLocation(property.district);
  const propertyNeighborhood = normalizedLocation(property.neighborhood);
  const reasons: string[] = [];
  const mismatches: string[] = [];

  if (!customerCity) return { mismatches, reasons, score: undefined };
  if (!propertyCity || customerCity !== propertyCity) {
    mismatches.push("City does not match customer preference");
    return { mismatches, reasons, score: 0 };
  }

  if (!customerDistrict) {
    reasons.push("City matches and customer did not restrict district");
    return { mismatches, reasons, score: MATCH_WEIGHTS.location };
  }

  if (customerDistrict !== propertyDistrict) {
    reasons.push("City matches customer preference");
    mismatches.push("District does not match customer preference");
    return { mismatches, reasons, score: 15 };
  }

  let score = 20;
  reasons.push("Exact city match");
  reasons.push("Exact district match");

  if (customerNeighborhood && propertyNeighborhood) {
    if (customerNeighborhood === propertyNeighborhood) {
      score = 25;
      reasons.push("Exact neighborhood match");
    } else {
      mismatches.push("Neighborhood does not match customer preference");
    }
  } else {
    score = 25;
  }

  return { mismatches, reasons, score };
}

function scoreRooms(customer: MatchCustomerInput, property: MatchPropertyInput) {
  const minRooms = parseRooms(customer.minRooms);
  const maxRooms = parseRooms(customer.maxRooms);
  const propertyRooms = parseRooms(property.rooms);
  const reasons: string[] = [];
  const mismatches: string[] = [];

  if (minRooms === undefined && maxRooms === undefined) return { mismatches, reasons, score: undefined };
  if (propertyRooms === undefined) return { mismatches, reasons, score: 0 };

  const min = minRooms ?? maxRooms;
  const max = maxRooms ?? minRooms;

  if (min !== undefined && max !== undefined && propertyRooms >= min && propertyRooms <= max) {
    reasons.push("Rooms match customer requirement");
    return { mismatches, reasons, score: MATCH_WEIGHTS.rooms };
  }

  if (min !== undefined && max !== undefined && (propertyRooms === min - 1 || propertyRooms === max + 1)) {
    mismatches.push("Rooms are close to customer requirement");
    return { mismatches, reasons, score: 5 };
  }

  mismatches.push("Rooms do not match customer requirement");
  return { mismatches, reasons, score: 0 };
}

function scorePropertyType(customer: MatchCustomerInput, property: MatchPropertyInput) {
  const customerType = normalized(customer.propertyType);
  const propertyType = normalized(property.propertyType) || normalized(property.type);
  const reasons: string[] = [];
  const mismatches: string[] = [];

  if (!customerType) return { mismatches, reasons, score: undefined };
  if (customerType === propertyType) {
    reasons.push("Property type matches customer preference");
    return { mismatches, reasons, score: MATCH_WEIGHTS.propertyType };
  }

  mismatches.push("Property type does not match customer preference");
  return { mismatches, reasons, score: 0 };
}

function scoreArea(customer: MatchCustomerInput, property: MatchPropertyInput) {
  const minArea = asNumber(customer.minArea);
  const maxArea = asNumber(customer.maxArea);
  const propertyArea = asNumber(property.grossArea) ?? asNumber(property.areaSqm) ?? asNumber(property.netArea);
  const reasons: string[] = [];
  const mismatches: string[] = [];

  if (!minArea && !maxArea) return { mismatches, reasons, score: undefined };
  if (!propertyArea) return { mismatches, reasons, score: 0 };

  if ((!minArea || propertyArea >= minArea) && (!maxArea || propertyArea <= maxArea)) {
    reasons.push("Area is within customer requirement");
    return { mismatches, reasons, score: MATCH_WEIGHTS.area };
  }

  if (minArea && propertyArea >= minArea * 0.9) {
    mismatches.push("Area is up to 10% below customer minimum");
    return { mismatches, reasons, score: 6 };
  }

  mismatches.push("Area does not match customer requirement");
  return { mismatches, reasons, score: 0 };
}

function scoreSpecialRequirements(customer: MatchCustomerInput, property: MatchPropertyInput) {
  const checks = [
    {
      customerKey: "citizenshipInterest",
      label: "Citizenship suitability",
      propertyKey: "citizenshipSuitable",
    },
    {
      customerKey: "residenceInterest",
      label: "Residence permit suitability",
      propertyKey: "residencePermitSuitable",
    },
    {
      customerKey: "investmentInterest",
      label: "Investment tag",
      propertyKey: "investmentSuitable",
    },
    { customerKey: "furnished", label: "Furnished", propertyKey: "furnished" },
    { customerKey: "pool", label: "Pool", propertyKey: "pool" },
    { customerKey: "parking", label: "Parking", propertyKey: "parking" },
    { customerKey: "balcony", label: "Balcony", propertyKey: "balcony" },
  ];
  const activeChecks = checks.filter((check) => asBoolean(customer[check.customerKey]));
  const reasons: string[] = [];
  const mismatches: string[] = [];

  if (!activeChecks.length) return { mismatches, reasons, score: undefined };

  const passed = activeChecks.filter((check) => asBoolean(property[check.propertyKey]));
  for (const check of passed) reasons.push(`${check.label} requirement is met`);
  for (const check of activeChecks) {
    if (!asBoolean(property[check.propertyKey])) {
      mismatches.push(`${check.label} requirement is not met`);
    }
  }

  return {
    mismatches,
    reasons,
    score: Math.round((passed.length / activeChecks.length) * MATCH_WEIGHTS.specialRequirements),
  };
}

export function calculatePropertyMatch(
  customer: MatchCustomerInput,
  property: MatchPropertyInput,
): MatchCalculationResult {
  const breakdown = emptyBreakdown();
  const reasons: string[] = [];
  const mismatches: string[] = [];
  const scores = {
    area: scoreArea(customer, property),
    budget: scoreBudget(customer, property),
    location: scoreLocation(customer, property),
    propertyType: scorePropertyType(customer, property),
    rooms: scoreRooms(customer, property),
    specialRequirements: scoreSpecialRequirements(customer, property),
  };

  for (const [key, result] of Object.entries(scores) as [MatchCriterionKey, (typeof scores)[MatchCriterionKey]][]) {
    setScore(breakdown, key, result.score);
    reasons.push(...result.reasons);
    mismatches.push(...result.mismatches);
  }

  const evaluated = Object.values(breakdown).filter((item) => item.evaluated);
  const availableWeight = evaluated.reduce((sum, item) => sum + item.max, 0);
  const rawScore = evaluated.reduce((sum, item) => sum + item.score, 0);
  const score = availableWeight ? Math.round((rawScore / availableWeight) * 100) : 0;

  return {
    areaScore: breakdown.area.evaluated ? breakdown.area.score : undefined,
    breakdown,
    budgetScore: breakdown.budget.evaluated ? breakdown.budget.score : undefined,
    calculationVersion: MATCHING_VERSION,
    locationScore: breakdown.location.evaluated ? breakdown.location.score : undefined,
    mismatches,
    propertyTypeScore: breakdown.propertyType.evaluated ? breakdown.propertyType.score : undefined,
    reasons,
    roomsScore: breakdown.rooms.evaluated ? breakdown.rooms.score : undefined,
    score: Math.max(0, Math.min(score, 100)),
    specialRequirementsScore: breakdown.specialRequirements.evaluated
      ? breakdown.specialRequirements.score
      : undefined,
  };
}
