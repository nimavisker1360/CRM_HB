import { handleApiError, jsonOk } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { cleanObject, escapeRegex, getPagination, paginationMeta } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { projectSchema } from "@/lib/validators";
import { Project } from "@/models";

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

    for (const key of ["city", "district", "status"] as const) {
      const value = searchParams.get(key);
      if (session.role === "AGENT" && key === "status") continue;
      if (value) query[key] = value;
    }
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      query.$or = [{ name: regex }, { developer: regex }, { city: regex }, { district: regex }];
    }

    const [items, total] = await Promise.all([
      Project.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Project.countDocuments(query),
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

    const parsed = projectSchema.parse(await request.json());
    const project = await Project.create(cleanObject(parsed));

    await logActivity({
      action: "CREATED",
      description: `${session.name} created project ${project.name}.`,
      entityId: String(project._id),
      entityType: "PROJECT",
      session,
    });

    return jsonOk(serializeMongo(project), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
