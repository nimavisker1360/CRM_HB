import "server-only";

import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import { Property } from "@/models";
import { clampLimit, defineTool, entity, escapeRegex, limitSchema, objectId, result } from "@/services/ai/tools/tool.shared";

const propertyStatuses = ["ACTIVE", "RESERVED", "SOLD", "RENTED", "PASSIVE", "DRAFT", "AVAILABLE", "ARCHIVED"] as const;
const propertyTypes = ["APARTMENT", "VILLA", "LAND", "COMMERCIAL", "OFFICE", "SHOP"] as const;
const searchSchema = z.object({
  search: z.string().trim().max(120).optional(), city: z.string().trim().max(100).optional(), district: z.string().trim().max(100).optional(),
  minPrice: z.coerce.number().nonnegative().optional(), maxPrice: z.coerce.number().nonnegative().optional(), rooms: z.coerce.number().int().nonnegative().max(100).optional(),
  propertyType: z.enum(propertyTypes).optional(), transactionType: z.enum(["SALE", "RENT"]).optional(), status: z.enum(propertyStatuses).optional(), limit: limitSchema,
}).strict().refine((value) => !value.minPrice || !value.maxPrice || value.minPrice <= value.maxPrice, "Invalid price range");
const idSchema = z.object({ propertyId: z.string() }).strict();

function compactProperty(property: Record<string, unknown>) {
  const project = property.projectId as Record<string, unknown> | undefined;
  return {
    id: String(property._id), title: property.title, code: property.propertyCode, status: property.status,
    transactionType: property.transactionType, propertyType: property.propertyType,
    price: property.price, currency: property.currency,
    location: { city: property.city, district: property.district, neighborhood: property.neighborhood },
    rooms: property.rooms ?? property.bedrooms ?? null,
    area: { gross: property.grossArea ?? property.areaSqm ?? null, net: property.netArea ?? null },
    features: { furnished: property.furnished, balcony: property.balcony, parking: property.parking, pool: property.pool, socialFacilities: property.socialFacilities || [] },
    project: project ? { id: String(project._id), name: project.name } : null,
  };
}

export const searchPropertiesTool = defineTool({
  declaration: {
    name: "searchProperties", description: "Search CRM properties with bounded filters. Agents can only retrieve active/available company inventory.",
    parametersJsonSchema: { type: "object", additionalProperties: false, properties: {
      search: { type: "string" }, city: { type: "string" }, district: { type: "string" }, minPrice: { type: "number", minimum: 0 }, maxPrice: { type: "number", minimum: 0 },
      rooms: { type: "integer", minimum: 0 }, propertyType: { type: "string", enum: propertyTypes }, transactionType: { type: "string", enum: ["SALE", "RENT"] },
      status: { type: "string", enum: propertyStatuses }, limit: { type: "integer", minimum: 1, maximum: 50 },
    } },
  },
  async execute(rawArgs, context) {
    const args = searchSchema.parse(rawArgs);
    await connectToDatabase();
    const query: Record<string, unknown> = {};
    if (context.session.role === "AGENT") query.status = { $in: ["ACTIVE", "AVAILABLE"] };
    else if (args.status) query.status = args.status;
    if (args.search) {
      const pattern = new RegExp(escapeRegex(args.search), "i");
      query.$or = [{ title: pattern }, { propertyCode: pattern }];
    }
    if (args.city) query.city = new RegExp(`^${escapeRegex(args.city)}$`, "i");
    if (args.district) query.district = new RegExp(`^${escapeRegex(args.district)}$`, "i");
    if (args.propertyType) query.propertyType = args.propertyType;
    if (args.transactionType) query.transactionType = args.transactionType;
    if (args.rooms !== undefined) query.rooms = args.rooms;
    if (args.minPrice !== undefined || args.maxPrice !== undefined) query.price = { ...(args.minPrice !== undefined ? { $gte: args.minPrice } : {}), ...(args.maxPrice !== undefined ? { $lte: args.maxPrice } : {}) };
    const limit = clampLimit(args.limit, context);
    const [rows, total] = await Promise.all([
      Property.find(query).sort({ status: 1, updatedAt: -1 }).limit(limit).select("title propertyCode status transactionType propertyType price currency city district neighborhood rooms bedrooms grossArea netArea areaSqm furnished balcony parking pool socialFacilities projectId").populate("projectId", "name").lean<Record<string, unknown>[]>(),
      Property.countDocuments(query),
    ]);
    const data = rows.map(compactProperty);
    return result(data, data.map((row) => entity("property", row.id, row.title)), total);
  },
});

export const getPropertyDetailsTool = defineTool({
  declaration: { name: "getPropertyDetails", description: "Get factual details for a real property ID returned by a CRM tool.", parametersJsonSchema: { type: "object", additionalProperties: false, properties: { propertyId: { type: "string" } }, required: ["propertyId"] } },
  async execute(rawArgs, context) {
    const { propertyId } = idSchema.parse(rawArgs);
    await connectToDatabase();
    const query: Record<string, unknown> = { _id: objectId(propertyId, "propertyId") };
    if (context.session.role === "AGENT") query.status = { $in: ["ACTIVE", "AVAILABLE"] };
    const property = await Property.findOne(query).select("title propertyCode status transactionType propertyType price currency city district neighborhood rooms bedrooms grossArea netArea areaSqm furnished balcony parking pool socialFacilities projectId").populate("projectId", "name").lean<Record<string, unknown>>();
    if (!property) throw new Error("FORBIDDEN_OR_NOT_FOUND");
    const data = compactProperty(property);
    return result(data, [entity("property", data.id, data.title)]);
  },
});

export const propertyTools = [searchPropertiesTool, getPropertyDetailsTool];
