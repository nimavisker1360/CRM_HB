import type { MATCH_STATUSES } from "@/services/matching/matching.config";

export type MatchStatus = (typeof MATCH_STATUSES)[number];

export type MatchCriterionKey =
  | "area"
  | "budget"
  | "location"
  | "propertyType"
  | "rooms"
  | "specialRequirements";

export type MatchBreakdownItem = {
  evaluated: boolean;
  max: number;
  score: number;
};

export type MatchBreakdown = Record<MatchCriterionKey, MatchBreakdownItem>;

export type MatchCalculationResult = {
  areaScore?: number;
  breakdown: MatchBreakdown;
  budgetScore?: number;
  calculationVersion: string;
  locationScore?: number;
  mismatches: string[];
  propertyTypeScore?: number;
  reasons: string[];
  roomsScore?: number;
  score: number;
  specialRequirementsScore?: number;
};

export type MatchCustomerInput = Record<string, unknown>;
export type MatchPropertyInput = Record<string, unknown>;

