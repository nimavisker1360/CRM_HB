import "server-only";

import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer } from "@/models";
import { clampLimit, contactDataRequested, defineTool, entity, escapeRegex, limitSchema, normalizeDate, objectId, result, scopedMongoQuery } from "@/services/ai/tools/tool.shared";

const customerStatuses = ["NEW_LEAD", "CONTACTED", "QUALIFIED", "PROPERTY_SENT", "MEETING", "NEGOTIATION", "WON", "LOST", "FOLLOW_UP", "NEW"] as const;

const searchSchema = z.object({
  query: z.string().trim().max(120).optional(),
  status: z.enum(customerStatuses).optional(),
  minBudget: z.coerce.number().nonnegative().optional(),
  maxBudget: z.coerce.number().nonnegative().optional(),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  transactionType: z.enum(["SALE", "RENT"]).optional(),
  propertyType: z.string().trim().max(80).optional(),
  limit: limitSchema,
}).strict().refine((value) => !value.minBudget || !value.maxBudget || value.minBudget <= value.maxBudget, "Invalid budget range");

const idSchema = z.object({ customerId: z.string() }).strict();

function compactCustomer(customer: Record<string, unknown>, includeContact: boolean) {
  const agent = customer.assignedAgentId as Record<string, unknown> | undefined;
  return {
    id: String(customer._id),
    fullName: customer.fullName,
    status: customer.status,
    budget: { min: customer.minBudget ?? customer.budgetMin ?? null, max: customer.maxBudget ?? customer.budgetMax ?? null, currency: customer.currency },
    preferences: {
      city: customer.interestedCity,
      district: customer.interestedDistrict,
      transactionType: customer.transactionType,
      propertyType: customer.propertyType,
      rooms: { min: customer.minRooms ?? null, max: customer.maxRooms ?? null },
      area: { min: customer.minArea ?? null, max: customer.maxArea ?? null },
    },
    assignedAgent: agent ? { id: String(agent._id), name: agent.fullName || agent.name } : null,
    lastActivityAt: normalizeDate(customer.lastActivityAt),
    nextFollowUp: normalizeDate(customer.nextFollowUp),
    ...(includeContact ? { phone: customer.phone, whatsapp: customer.whatsapp || null, email: customer.email || null } : {}),
  };
}

export const searchCustomersTool = defineTool({
  declaration: {
    name: "searchCustomers",
    description: "Search authorized CRM customers by name, status, budget, location, transaction, or property type. Scope is applied by the server.",
    parametersJsonSchema: {
      type: "object", additionalProperties: false,
      properties: {
        query: { type: "string" }, status: { type: "string", enum: customerStatuses },
        minBudget: { type: "number", minimum: 0 }, maxBudget: { type: "number", minimum: 0 },
        city: { type: "string" }, district: { type: "string" },
        transactionType: { type: "string", enum: ["SALE", "RENT"] }, propertyType: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  async execute(rawArgs, context) {
    const args = searchSchema.parse(rawArgs);
    await connectToDatabase();
    const base: Record<string, unknown> = {};
    if (args.query) {
      const pattern = new RegExp(escapeRegex(args.query), "i");
      base.$or = [{ fullName: pattern }, { email: pattern }, { phone: pattern }];
    }
    if (args.status) base.status = args.status;
    if (args.city) base.interestedCity = new RegExp(`^${escapeRegex(args.city)}$`, "i");
    if (args.district) base.interestedDistrict = new RegExp(`^${escapeRegex(args.district)}$`, "i");
    if (args.transactionType) base.transactionType = args.transactionType;
    if (args.propertyType) base.propertyType = new RegExp(`^${escapeRegex(args.propertyType)}$`, "i");
    if (args.minBudget !== undefined || args.maxBudget !== undefined) {
      base.maxBudget = { ...(args.minBudget !== undefined ? { $gte: args.minBudget } : {}), ...(args.maxBudget !== undefined ? { $lte: args.maxBudget } : {}) };
    }
    const query = scopedMongoQuery(base, context.scope, ["assignedAgentId", "assignedAgent"]);
    const limit = clampLimit(args.limit, context);
    const [rows, total] = await Promise.all([
      Customer.find(query).sort({ lastActivityAt: -1, createdAt: -1 }).limit(limit).select("fullName phone whatsapp email status minBudget maxBudget budgetMin budgetMax currency interestedCity interestedDistrict transactionType propertyType minRooms maxRooms minArea maxArea assignedAgentId lastActivityAt nextFollowUp").populate("assignedAgentId", "fullName name").lean<Record<string, unknown>[]>(),
      Customer.countDocuments(query),
    ]);
    const data = rows.map((row) => compactCustomer(row, contactDataRequested(context.userMessage)));
    return result(data, data.map((row) => entity("customer", row.id, row.fullName)), total);
  },
});

export const getCustomerDetailsTool = defineTool({
  declaration: {
    name: "getCustomerDetails",
    description: "Get a single authorized customer's CRM summary by a real customer ID returned by a tool.",
    parametersJsonSchema: { type: "object", additionalProperties: false, properties: { customerId: { type: "string" } }, required: ["customerId"] },
  },
  async execute(rawArgs, context) {
    const { customerId } = idSchema.parse(rawArgs);
    await connectToDatabase();
    const query = scopedMongoQuery({ _id: objectId(customerId, "customerId") }, context.scope, ["assignedAgentId", "assignedAgent"]);
    const customer = await Customer.findOne(query).select("fullName phone whatsapp email status minBudget maxBudget budgetMin budgetMax currency interestedCity interestedDistrict transactionType propertyType minRooms maxRooms minArea maxArea assignedAgentId lastActivityAt nextFollowUp createdAt").populate("assignedAgentId", "fullName name").lean<Record<string, unknown>>();
    if (!customer) throw new Error("FORBIDDEN_OR_NOT_FOUND");
    const data = compactCustomer(customer, contactDataRequested(context.userMessage));
    return result(data, [entity("customer", data.id, data.fullName)]);
  },
});

export const customerTools = [searchCustomersTool, getCustomerDetailsTool];
