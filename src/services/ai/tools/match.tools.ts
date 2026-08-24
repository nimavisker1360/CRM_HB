import "server-only";

import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer, Property, PropertyMatch } from "@/models";
import { findCustomersForProperty, findMatchesForCustomer } from "@/services/matching/matching.service";
import { clampLimit, defineTool, entity, limitSchema, objectId, result, scopedMongoQuery, uniqueEntities } from "@/services/ai/tools/tool.shared";

const customerSchema = z.object({ customerId: z.string(), limit: limitSchema }).strict();
const propertySchema = z.object({ propertyId: z.string(), limit: limitSchema }).strict();
const recentSchema = z.object({ status: z.enum(["NEW", "VIEWED", "SENT", "INTERESTED", "REJECTED", "MEETING", "ARCHIVED"]).optional(), minScore: z.coerce.number().min(0).max(100).optional(), limit: limitSchema }).strict();

function compactMatch(match: Record<string, unknown>) {
  const property = match.propertyId as Record<string, unknown> | undefined;
  const customer = match.customerId as Record<string, unknown> | undefined;
  return {
    id: String(match._id), score: Number(match.score), status: match.status,
    reasons: match.reasons || [], mismatches: match.mismatches || [], breakdown: match.breakdown || null,
    customer: customer ? { id: String(customer._id), fullName: customer.fullName, status: customer.status, budget: { max: customer.maxBudget, currency: customer.currency } } : null,
    property: property ? { id: String(property._id), title: property.title, code: property.propertyCode, price: property.price, currency: property.currency, city: property.city, district: property.district, rooms: property.rooms, area: property.grossArea ?? property.areaSqm, status: property.status } : null,
  };
}

export const getCustomerMatchesTool = defineTool({
  declaration: { name: "getCustomerMatches", description: "Get existing matching-engine results for an authorized customer. Scores are authoritative and must not be recalculated.", parametersJsonSchema: { type: "object", additionalProperties: false, properties: { customerId: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["customerId"] } },
  async execute(rawArgs, context) {
    const args = customerSchema.parse(rawArgs);
    await connectToDatabase();
    const customerId = objectId(args.customerId, "customerId");
    const authorized = await Customer.exists(scopedMongoQuery({ _id: customerId }, context.scope, ["assignedAgentId", "assignedAgent"]));
    if (!authorized) throw new Error("FORBIDDEN_OR_NOT_FOUND");
    const rows = await findMatchesForCustomer(customerId, clampLimit(args.limit, context));
    const data = (rows as Array<Record<string, unknown>>).map(compactMatch);
    const entities = data.flatMap((row) => [entity("match", row.id, `${row.property?.title || "تطبیق"} — ${row.score}%`), ...(row.property ? [entity("property", row.property.id, row.property.title)] : [])]);
    return result(data, uniqueEntities(entities));
  },
});

export const getPropertyMatchingCustomersTool = defineTool({
  declaration: { name: "getPropertyMatchingCustomers", description: "Get customers with existing matching-engine records for a property. Customer scope is enforced by the server.", parametersJsonSchema: { type: "object", additionalProperties: false, properties: { propertyId: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["propertyId"] } },
  async execute(rawArgs, context) {
    const args = propertySchema.parse(rawArgs);
    await connectToDatabase();
    const propertyId = objectId(args.propertyId, "propertyId");
    const property = await Property.findById(propertyId).select("title status").lean<Record<string, unknown>>();
    if (!property || (context.session.role === "AGENT" && !["ACTIVE", "AVAILABLE"].includes(String(property.status)))) throw new Error("FORBIDDEN_OR_NOT_FOUND");
    const rows = await findCustomersForProperty(propertyId, clampLimit(args.limit, context), context.scope.effectiveAgentId);
    const data = (rows as Array<Record<string, unknown>>).map(compactMatch);
    const entities = data.flatMap((row) => [entity("match", row.id, `${row.customer?.fullName || "تطبیق"} — ${row.score}%`), ...(row.customer ? [entity("customer", row.customer.id, row.customer.fullName)] : [])]);
    return result(data, uniqueEntities(entities));
  },
});

export const getRecentMatchesTool = defineTool({
  declaration: { name: "getRecentMatches", description: "Get recent existing match records in the authorized scope.", parametersJsonSchema: { type: "object", additionalProperties: false, properties: { status: { type: "string", enum: ["NEW", "VIEWED", "SENT", "INTERESTED", "REJECTED", "MEETING", "ARCHIVED"] }, minScore: { type: "number", minimum: 0, maximum: 100 }, limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  async execute(rawArgs, context) {
    const args = recentSchema.parse(rawArgs);
    await connectToDatabase();
    const base: Record<string, unknown> = {};
    if (args.status) base.status = args.status;
    else base.status = { $ne: "ARCHIVED" };
    if (args.minScore !== undefined) base.score = { $gte: args.minScore };
    const query = context.scope.effectiveAgentId ? { ...base, agentId: objectId(context.scope.effectiveAgentId, "effectiveAgentId") } : base;
    const limit = clampLimit(args.limit, context);
    const [rows, total] = await Promise.all([
      PropertyMatch.find(query).sort({ createdAt: -1, score: -1 }).limit(limit).populate("customerId", "fullName status maxBudget currency").populate("propertyId", "title propertyCode price currency city district rooms grossArea areaSqm status").lean<Record<string, unknown>[]>(),
      PropertyMatch.countDocuments(query),
    ]);
    const data = rows.map(compactMatch);
    return result(data, data.map((row) => entity("match", row.id, `${row.customer?.fullName || "تطبیق"} — ${row.score}%`)), total);
  },
});

export const matchTools = [getCustomerMatchesTool, getPropertyMatchingCustomersTool, getRecentMatchesTool];
