import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { Customer, Property, PropertyMatch } from "@/models";
import {
  ACTIVE_CUSTOMER_STATUSES,
  ACTIVE_PROPERTY_STATUS,
  MATCHING_VERSION,
  MATCH_MIN_SCORE,
} from "@/services/matching/matching.config";
import { calculatePropertyMatch } from "@/services/matching/matching.rules";
import type { MatchCalculationResult, MatchStatus } from "@/services/matching/matching.types";
import { NOTIFICATION_MATCH_MIN_SCORE } from "@/services/notifications/notification.config";
import { createNewMatchNotification } from "@/services/notifications/notification.service";

type LeanRecord = Record<string, unknown> & { _id: Types.ObjectId };

const LOCATION_COLLATION = { locale: "tr", strength: 1 } as const;

export const MATCH_STATUS_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  ARCHIVED: ["VIEWED", "SENT", "INTERESTED", "REJECTED", "MEETING"],
  INTERESTED: ["VIEWED", "SENT", "REJECTED", "MEETING", "ARCHIVED"],
  MEETING: ["VIEWED", "SENT", "INTERESTED", "REJECTED", "ARCHIVED"],
  NEW: ["VIEWED", "SENT", "INTERESTED", "REJECTED", "MEETING", "ARCHIVED"],
  REJECTED: ["VIEWED", "SENT", "INTERESTED", "MEETING", "ARCHIVED"],
  SENT: ["VIEWED", "INTERESTED", "REJECTED", "MEETING", "ARCHIVED"],
  VIEWED: ["SENT", "INTERESTED", "REJECTED", "MEETING", "ARCHIVED"],
};

function objectId(value: unknown) {
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === "string" && Types.ObjectId.isValid(value)) return new Types.ObjectId(value);
  return undefined;
}

function agentIdForCustomer(customer: Record<string, unknown>) {
  return objectId(customer.assignedAgentId) ?? objectId(customer.assignedAgent);
}

function isEligibleCustomer(customer?: Record<string, unknown> | null): customer is LeanRecord {
  return Boolean(customer && ACTIVE_CUSTOMER_STATUSES.includes(String(customer.status) as never));
}

function propertyCandidateQuery(customer: Record<string, unknown>) {
  const query: Record<string, unknown> = { status: ACTIVE_PROPERTY_STATUS };
  if (customer.transactionType) query.transactionType = customer.transactionType;
  if (customer.interestedCity) query.city = customer.interestedCity;

  const maxBudget = Number(customer.maxBudget || customer.budgetMax || 0);
  if (maxBudget > 0) {
    query.price = { $lte: Math.round(maxBudget * 1.15) };
  }

  return query;
}

function customerCandidateQuery(property: Record<string, unknown>) {
  const query: Record<string, unknown> = { status: { $in: ACTIVE_CUSTOMER_STATUSES } };
  if (property.transactionType) query.transactionType = property.transactionType;
  if (property.city) query.interestedCity = property.city;

  const price = Number(property.price || 0);
  if (price > 0) {
    query.$or = [{ maxBudget: { $exists: false } }, { maxBudget: { $gte: Math.round(price / 1.15) } }];
  }

  return query;
}

async function deleteCustomerMatchesOutsideCandidates(customerId: Types.ObjectId, propertyIds: Types.ObjectId[]) {
  await PropertyMatch.deleteMany({
    customerId,
    ...(propertyIds.length ? { propertyId: { $nin: propertyIds } } : {}),
  });
}

async function deletePropertyMatchesOutsideCandidates(propertyId: Types.ObjectId, customerIds: Types.ObjectId[]) {
  await PropertyMatch.deleteMany({
    propertyId,
    ...(customerIds.length ? { customerId: { $nin: customerIds } } : {}),
  });
}

async function saveMatch(
  customer: LeanRecord,
  property: LeanRecord,
  result: MatchCalculationResult,
) {
  const customerId = customer._id;
  const propertyId = property._id;
  const agentId = agentIdForCustomer(customer);

  if (result.score < MATCH_MIN_SCORE) {
    await PropertyMatch.deleteOne({ customerId, propertyId });
    return null;
  }

  const writeResult = await PropertyMatch.updateOne(
    { customerId, propertyId },
    {
      $set: {
        agentId,
        areaScore: result.areaScore,
        breakdown: result.breakdown,
        budgetScore: result.budgetScore,
        calculationVersion: result.calculationVersion,
        lastCalculatedAt: new Date(),
        locationScore: result.locationScore,
        mismatches: result.mismatches,
        propertyTypeScore: result.propertyTypeScore,
        reasons: result.reasons,
        roomsScore: result.roomsScore,
        score: result.score,
        specialRequirementsScore: result.specialRequirementsScore,
      },
      $setOnInsert: { status: "NEW" },
    },
    { runValidators: true, upsert: true },
  );
  const match = await PropertyMatch.findOne({ customerId, propertyId });

  if (match && writeResult.upsertedCount > 0 && result.score >= NOTIFICATION_MATCH_MIN_SCORE) {
    await createNewMatchNotification({
      agentId,
      customerId,
      customerName: String(customer.fullName || ""),
      matchId: match._id,
      propertyId,
      propertyTitle: String(property.title || property.propertyCode || ""),
      score: result.score,
    }).catch((error) => console.error("[notification:new-match]", error));
  }

  return match;
}

export async function recalculateCustomerMatches(customerId: string | Types.ObjectId, limit = 100) {
  await connectToDatabase();
  const _id = objectId(customerId);
  if (!_id) return { saved: 0, scanned: 0 };

  const customer = await Customer.findById(_id).lean<LeanRecord | null>();
  if (!isEligibleCustomer(customer)) {
    await PropertyMatch.updateMany({ customerId: _id }, { $set: { status: "ARCHIVED" } });
    return { saved: 0, scanned: 0 };
  }

  const candidateQuery = propertyCandidateQuery(customer);
  const candidateProperties = await Property.find(candidateQuery)
    .collation(LOCATION_COLLATION)
    .select("_id")
    .lean<LeanRecord[]>();
  await deleteCustomerMatchesOutsideCandidates(_id, candidateProperties.map((property) => property._id));

  const properties = await Property.find(candidateQuery)
    .collation(LOCATION_COLLATION)
    .limit(limit)
    .lean<LeanRecord[]>();
  let saved = 0;

  for (const property of properties) {
    const match = await saveMatch(customer, property, calculatePropertyMatch(customer, property));
    if (match) saved += 1;
  }

  await Customer.updateOne(
    { _id },
    {
      $set: {
        lastMatchedAt: new Date(),
        matchCalculationVersion: MATCHING_VERSION,
        matchingPending: false,
      },
      $unset: { matchingRequiredAt: "" },
    },
  );

  return { saved, scanned: properties.length };
}

export async function recalculatePropertyMatches(propertyId: string | Types.ObjectId, limit = 100) {
  await connectToDatabase();
  const _id = objectId(propertyId);
  if (!_id) return { saved: 0, scanned: 0 };

  const property = await Property.findById(_id).lean<LeanRecord | null>();
  if (!property || property.status !== ACTIVE_PROPERTY_STATUS) {
    await PropertyMatch.updateMany({ propertyId: _id }, { $set: { status: "ARCHIVED" } });
    return { saved: 0, scanned: 0 };
  }

  const candidateQuery = customerCandidateQuery(property);
  const candidateCustomers = await Customer.find(candidateQuery)
    .collation(LOCATION_COLLATION)
    .select("_id")
    .lean<LeanRecord[]>();
  await deletePropertyMatchesOutsideCandidates(_id, candidateCustomers.map((customer) => customer._id));

  const customers = await Customer.find(candidateQuery)
    .collation(LOCATION_COLLATION)
    .limit(limit)
    .lean<LeanRecord[]>();
  let saved = 0;

  for (const customer of customers) {
    const match = await saveMatch(customer, property, calculatePropertyMatch(customer, property));
    if (match) saved += 1;
  }

  await Property.updateOne(
    { _id },
    {
      $set: {
        lastMatchedAt: new Date(),
        matchCalculationVersion: MATCHING_VERSION,
        matchingPending: false,
      },
      $unset: { matchingRequiredAt: "" },
    },
  );

  return { saved, scanned: customers.length };
}

export async function findMatchesForCustomer(customerId: string | Types.ObjectId, limit = 10) {
  await connectToDatabase();
  return serializeMongo(
    await PropertyMatch.find({ customerId, status: { $ne: "ARCHIVED" }, score: { $gte: MATCH_MIN_SCORE } })
      .sort({ score: -1, updatedAt: -1 })
      .limit(limit)
      .populate({ path: "propertyId", populate: { path: "projectId", select: "name developer" } })
      .populate("agentId", "fullName name email")
      .lean(),
  );
}

export async function findCustomersForProperty(
  propertyId: string | Types.ObjectId,
  limit = 10,
  agentId?: string,
) {
  await connectToDatabase();
  const query: Record<string, unknown> = {
    propertyId,
    score: { $gte: MATCH_MIN_SCORE },
    status: { $ne: "ARCHIVED" },
  };
  const scopedAgentId = objectId(agentId);
  if (scopedAgentId) query.agentId = scopedAgentId;

  return serializeMongo(
    await PropertyMatch.find(query)
      .sort({ score: -1, updatedAt: -1 })
      .limit(limit)
      .populate("customerId", "fullName phone maxBudget minBudget currency interestedCity interestedDistrict assignedAgentId")
      .populate("agentId", "fullName name email")
      .lean(),
  );
}

export function isValidMatchTransition(from: MatchStatus, to: MatchStatus) {
  return MATCH_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
