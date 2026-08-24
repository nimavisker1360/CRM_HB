import { handleApiError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getPagination, paginationMeta } from "@/lib/crm-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { serializeMongo } from "@/lib/serialize";
import { ImportJob } from "@/models";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const { limit, page, skip } = getPagination(searchParams);

    const [items, total] = await Promise.all([
      ImportJob.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name email role")
        .lean(),
      ImportJob.countDocuments({}),
    ]);

    return jsonOk({ items: serializeMongo(items), pagination: paginationMeta(total, page, limit) });
  } catch (error) {
    return handleApiError(error);
  }
}
