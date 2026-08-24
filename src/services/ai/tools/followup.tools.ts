import "server-only";

import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import { FollowUp } from "@/models";
import { clampLimit, contactDataRequested, defineTool, entity, limitSchema, normalizeDate, objectId, result, scopedMongoQuery, uniqueEntities } from "@/services/ai/tools/tool.shared";

const filterSchema = z.object({
  filter: z.enum(["today", "upcoming", "overdue", "completed", "all"]).optional(),
  customerId: z.string().optional(), limit: limitSchema,
}).strict();
const overdueSchema = z.object({ limit: limitSchema }).strict();
const openStatuses = ["PENDING", "OPEN", "OVERDUE"];

function dayBounds(now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { start, end };
}

function compactFollowUp(row: Record<string, unknown>, includeContact: boolean) {
  const customer = (row.customerId || row.customer) as Record<string, unknown> | undefined;
  return {
    id: String(row._id), title: row.title, type: row.type || row.channel, status: row.status,
    scheduledAt: normalizeDate(row.scheduledAt || row.dueAt), dueAt: normalizeDate(row.dueAt), completedAt: normalizeDate(row.completedAt),
    customer: customer ? { id: String(customer._id), fullName: customer.fullName, status: customer.status, ...(includeContact ? { phone: customer.phone, whatsapp: customer.whatsapp || null } : {}) } : null,
  };
}

async function runFollowUpQuery(rawArgs: unknown, context: Parameters<typeof getFollowUpsTool.execute>[1], forceOverdue = false) {
  const args = forceOverdue ? { ...overdueSchema.parse(rawArgs), filter: "overdue" as const } : filterSchema.parse(rawArgs);
  await connectToDatabase();
  const { start, end } = dayBounds();
  const base: Record<string, unknown> = {};
  if (args.customerId) base.$or = [{ customerId: objectId(args.customerId, "customerId") }, { customer: objectId(args.customerId, "customerId") }];
  const filter = args.filter || "all";
  if (filter === "today") Object.assign(base, { status: { $in: openStatuses }, $and: [...((base.$and as unknown[]) || []), { $or: [{ scheduledAt: { $gte: start, $lt: end } }, { dueAt: { $gte: start, $lt: end } }] }] });
  if (filter === "upcoming") Object.assign(base, { status: { $in: openStatuses }, $and: [...((base.$and as unknown[]) || []), { $or: [{ scheduledAt: { $gte: end } }, { dueAt: { $gte: end } }] }] });
  if (filter === "overdue") Object.assign(base, { status: { $in: openStatuses }, $and: [...((base.$and as unknown[]) || []), { $or: [{ scheduledAt: { $lt: new Date() } }, { dueAt: { $lt: new Date() } }] }] });
  if (filter === "completed") base.status = { $in: ["COMPLETED", "DONE"] };
  const query = scopedMongoQuery(base, context.scope, ["agentId", "assignedAgent"]);
  const limit = clampLimit(args.limit, context);
  const [rows, total] = await Promise.all([
    FollowUp.find(query).sort({ dueAt: 1, scheduledAt: 1 }).limit(limit).select("title type channel status scheduledAt dueAt completedAt customerId customer").populate("customerId", "fullName status phone whatsapp").populate("customer", "fullName status phone whatsapp").lean<Record<string, unknown>[]>(),
    FollowUp.countDocuments(query),
  ]);
  const data = rows.map((row) => compactFollowUp(row, contactDataRequested(context.userMessage)));
  const entities = data.flatMap((row) => [entity("followup", row.id, row.title), ...(row.customer ? [entity("customer", row.customer.id, row.customer.fullName)] : [])]);
  return result(data, uniqueEntities(entities), total);
}

export const getFollowUpsTool = defineTool({
  declaration: { name: "getFollowUps", description: "Get authorized CRM follow-ups filtered by today, upcoming, overdue, completed, or customer.", parametersJsonSchema: { type: "object", additionalProperties: false, properties: { filter: { type: "string", enum: ["today", "upcoming", "overdue", "completed", "all"] }, customerId: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  execute(rawArgs, context) { return runFollowUpQuery(rawArgs, context); },
});

export const getOverdueFollowUpsTool = defineTool({
  declaration: { name: "getOverdueFollowUps", description: "Get overdue follow-ups in the server-enforced agent or company scope.", parametersJsonSchema: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  execute(rawArgs, context) { return runFollowUpQuery(rawArgs, context, true); },
});

export const followUpTools = [getFollowUpsTool, getOverdueFollowUpsTool];
