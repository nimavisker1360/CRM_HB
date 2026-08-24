import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { cleanObject, escapeRegex, getPagination, objectIdOrUndefined, paginationMeta } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { propertySchema } from "@/lib/validators";
import { Project, Property } from "@/models";
import { recalculatePropertyMatches } from "@/services/matching/matching.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { limit, page, skip } = getPagination(searchParams);
    const q = searchParams.get("q")?.trim();
    const query: Record<string, unknown> = {
      ...(session.role === "AGENT" ? { status: "ACTIVE" } : {}),
    };

    for (const key of ["city", "district", "transactionType", "propertyType", "status"] as const) {
      const value = searchParams.get(key);
      if (session.role === "AGENT" && key === "status") continue;
      if (value) query[key] = value;
    }

    const rooms = searchParams.get("rooms");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const assignedAgentId = objectIdOrUndefined(searchParams.get("assignedAgentId"));
    const projectId = objectIdOrUndefined(searchParams.get("projectId"));

    if (rooms) query.rooms = Number(rooms);
    if (minPrice || maxPrice) {
      query.price = {
        ...(minPrice ? { $gte: Number(minPrice) } : {}),
        ...(maxPrice ? { $lte: Number(maxPrice) } : {}),
      };
    }
    if (assignedAgentId) query.assignedAgentId = assignedAgentId;
    if (projectId) query.projectId = projectId;
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      const projects = await Project.find({ name: regex }).select("_id").lean();
      query.$or = [
        { title: regex },
        { propertyCode: regex },
        { city: regex },
        { district: regex },
        { projectId: { $in: projects.map((project) => project._id) } },
      ];
    }

    const [items, total] = await Promise.all([
      Property.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("projectId", "name")
        .populate("assignedAgentId", "fullName name")
        .lean(),
      Property.countDocuments(query),
    ]);

    return jsonOk({ items: serializeMongo(items), pagination: paginationMeta(total, page, limit) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();

    const parsed = propertySchema.parse(await request.json());
    const existing = await Property.findOne({ propertyCode: parsed.propertyCode }).select("_id").lean();

    if (existing) {
      return jsonError("PROPERTY_CODE_EXISTS", "Duplicate property code is not allowed.", 409);
    }

    const property = await Property.create(
      cleanObject({
        ...parsed,
        assignedAgent: parsed.assignedAgentId,
        areaSqm: parsed.grossArea,
        bedrooms: parsed.rooms,
        createdBy: session.userId,
        matchingPending: true,
        matchingRequiredAt: new Date(),
        type: parsed.propertyType,
      }),
    );

    await logActivity({
      action: "CREATED",
      description: `${session.name} created property ${property.title}.`,
      entityId: String(property._id),
      entityType: "PROPERTY",
      session,
    });
    await recalculatePropertyMatches(property._id);

    return jsonOk(serializeMongo(property), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
