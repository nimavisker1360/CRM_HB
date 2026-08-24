import "server-only";

import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models";
import { clampLimit, defineTool, entity, escapeRegex, limitSchema, normalizeDate, objectId, result } from "@/services/ai/tools/tool.shared";

const searchSchema = z.object({
  search: z.string().trim().max(120).optional(), city: z.string().trim().max(100).optional(), district: z.string().trim().max(100).optional(),
  status: z.enum(["PLANNED", "ACTIVE", "DELIVERED", "ARCHIVED"]).optional(), limit: limitSchema,
}).strict();
const idSchema = z.object({ projectId: z.string() }).strict();

function compactProject(project: Record<string, unknown>) {
  return {
    id: String(project._id), name: project.name, developer: project.developer || null, description: project.description || null,
    location: { city: project.city, district: project.district }, status: project.status,
    deliveryDate: normalizeDate(project.deliveryDate), paymentPlan: project.paymentPlan || null,
    citizenshipSuitable: Boolean(project.citizenshipSuitable), residenceSuitable: Boolean(project.residenceSuitable), facilities: project.facilities || [],
  };
}

export const searchProjectsTool = defineTool({
  declaration: { name: "searchProjects", description: "Search real CRM projects by name, city, district, or status.", parametersJsonSchema: { type: "object", additionalProperties: false, properties: { search: { type: "string" }, city: { type: "string" }, district: { type: "string" }, status: { type: "string", enum: ["PLANNED", "ACTIVE", "DELIVERED", "ARCHIVED"] }, limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  async execute(rawArgs, context) {
    const args = searchSchema.parse(rawArgs);
    await connectToDatabase();
    const query: Record<string, unknown> = {};
    if (args.search) query.name = new RegExp(escapeRegex(args.search), "i");
    if (args.city) query.city = new RegExp(`^${escapeRegex(args.city)}$`, "i");
    if (args.district) query.district = new RegExp(`^${escapeRegex(args.district)}$`, "i");
    if (args.status) query.status = args.status;
    const limit = clampLimit(args.limit, context);
    const [rows, total] = await Promise.all([
      Project.find(query).sort({ status: 1, updatedAt: -1 }).limit(limit).select("name developer city district status deliveryDate paymentPlan citizenshipSuitable residenceSuitable facilities").lean<Record<string, unknown>[]>(),
      Project.countDocuments(query),
    ]);
    const data = rows.map(compactProject);
    return result(data, data.map((row) => entity("project", row.id, row.name)), total);
  },
});

export const getProjectDetailsTool = defineTool({
  declaration: { name: "getProjectDetails", description: "Get factual CRM details for a real project ID returned by a tool.", parametersJsonSchema: { type: "object", additionalProperties: false, properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  async execute(rawArgs) {
    const { projectId } = idSchema.parse(rawArgs);
    await connectToDatabase();
    const project = await Project.findById(objectId(projectId, "projectId")).select("name developer description city district status deliveryDate paymentPlan citizenshipSuitable residenceSuitable facilities").lean<Record<string, unknown>>();
    if (!project) throw new Error("NOT_FOUND");
    const data = compactProject(project);
    return result(data, [entity("project", data.id, data.name)]);
  },
});

export const projectTools = [searchProjectsTool, getProjectDetailsTool];
