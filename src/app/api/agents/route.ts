import { handleApiError, jsonOk } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { syncUserForAgentProfile } from "@/lib/auth/users";
import { cleanObject, escapeRegex, getPagination, paginationMeta } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { agentSchema } from "@/lib/validators";
import { Agent } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN", "MANAGER"]);
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { limit, page, skip } = getPagination(searchParams);
    const q = searchParams.get("q")?.trim();
    const query: Record<string, unknown> = {};

    for (const key of ["role", "status"] as const) {
      const value = searchParams.get(key);
      if (value) query[key] = value;
    }
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      query.$or = [{ fullName: regex }, { name: regex }, { email: regex }, { phone: regex }];
    }

    const [items, total] = await Promise.all([
      Agent.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Agent.countDocuments(query),
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

    const parsed = agentSchema.parse(await request.json());
    const user = await syncUserForAgentProfile({
      email: parsed.email,
      fullName: parsed.fullName,
      password: parsed.password || "Agent123!",
      phone: parsed.phone,
      role: parsed.role,
      status: parsed.status,
    });
    const agent = await Agent.findOneAndUpdate(
      { email: parsed.email.toLowerCase() },
      cleanObject({
        ...parsed,
        name: parsed.fullName,
        user: user._id,
        userId: user._id,
      }),
      { returnDocument: "after", runValidators: true, setDefaultsOnInsert: true, upsert: true },
    );

    await logActivity({
      action: "CREATED",
      description: `${session.name} created agent ${agent.fullName}.`,
      entityId: String(agent._id),
      entityType: "AGENT",
      metadata: { activityKey: "AGENT_CREATED", actorName: session.name, subjectName: agent.fullName },
      session,
    });

    return jsonOk(serializeMongo(agent), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
