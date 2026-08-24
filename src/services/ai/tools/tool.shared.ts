import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import type { AgentScope } from "@/lib/auth/agent-scope";
import type { AIEntity, AIToolContext, AIToolResult, ApprovedAITool } from "@/services/ai/ai.types";

export const limitSchema = z.coerce.number().int().min(1).max(50).optional();

export function clampLimit(value: number | undefined, context: AIToolContext, fallback = 10) {
  return Math.min(value || fallback, context.maxItems);
}

export function objectId(value: unknown, field = "id") {
  if (typeof value !== "string" || !isValidObjectId(value)) {
    throw new Error(`INVALID_TOOL_ARGUMENT:${field}`);
  }
  return new Types.ObjectId(value);
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function scopedMongoQuery(
  base: Record<string, unknown>,
  scope: AgentScope,
  fields: string[],
): Record<string, unknown> {
  if (!scope.effectiveAgentId) return base;
  const id = objectId(scope.effectiveAgentId, "effectiveAgentId");
  return { $and: [base, { $or: fields.map((field) => ({ [field]: id })) }] };
}

export function contactDataRequested(message: string) {
  return /(تماس|شماره|تلفن|زنگ|phone|call|contact|telefon|ara\b)/iu.test(message);
}

export function entity(type: AIEntity["type"], id: unknown, label: unknown): AIEntity {
  const normalizedId = String(id);
  const roots: Record<AIEntity["type"], string> = {
    agent: "agents",
    customer: "customers",
    followup: "follow-ups",
    match: "matches",
    project: "projects",
    property: "properties",
  };
  return { type, id: normalizedId, label: String(label || type), url: `/${roots[type]}/${normalizedId}` };
}

export function result(data: unknown, entities: AIEntity[] = [], total?: number): AIToolResult {
  const returned = Array.isArray(data) ? data.length : data ? 1 : 0;
  return {
    data,
    entities,
    meta: { returned, total, truncated: typeof total === "number" && returned < total },
  };
}

export function defineTool(tool: ApprovedAITool) {
  return tool;
}

export function uniqueEntities(entities: AIEntity[]) {
  return [...new Map(entities.map((item) => [`${item.type}:${item.id}`, item])).values()];
}

export function normalizeDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
