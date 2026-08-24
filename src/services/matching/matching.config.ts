export const MATCHING_VERSION = "1.0";
export const MATCH_MIN_SCORE = 60;
export const MATCH_STRONG_SCORE = 80;

export const MATCH_WEIGHTS = {
  area: 10,
  budget: 30,
  location: 25,
  propertyType: 10,
  rooms: 15,
  specialRequirements: 10,
} as const;

export const MATCH_STATUSES = [
  "NEW",
  "VIEWED",
  "SENT",
  "INTERESTED",
  "REJECTED",
  "MEETING",
  "ARCHIVED",
] as const;

export const ACTIVE_CUSTOMER_STATUSES = [
  "NEW",
  "NEW_LEAD",
  "CONTACTED",
  "QUALIFIED",
  "PROPERTY_SENT",
  "FOLLOW_UP",
  "MEETING",
  "NEGOTIATION",
] as const;

export const ACTIVE_PROPERTY_STATUS = "ACTIVE";
