import { z } from "zod";
import { handleApiError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getTurkeyDistricts, getTurkeyNeighborhoods, getTurkeyProvinces } from "@/lib/turkey-locations";

export const runtime = "nodejs";

const querySchema = z.discriminatedUnion("level", [
  z.object({ level: z.literal("provinces") }),
  z.object({ level: z.literal("districts"), province: z.string().trim().min(1).max(80) }),
  z.object({ level: z.literal("neighborhoods"), province: z.string().trim().min(1).max(80), district: z.string().trim().min(1).max(100) }),
]);

export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      level: url.searchParams.get("level"),
      province: url.searchParams.get("province") || undefined,
      district: url.searchParams.get("district") || undefined,
    });
    if (parsed.level === "provinces") return jsonOk(getTurkeyProvinces());
    if (parsed.level === "districts") return jsonOk(getTurkeyDistricts(parsed.province));
    return jsonOk(getTurkeyNeighborhoods(parsed.province, parsed.district));
  } catch (error) {
    return handleApiError(error);
  }
}
