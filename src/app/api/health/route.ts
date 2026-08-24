import mongoose from "mongoose";
import { jsonOk } from "@/lib/api";
import { connectToDatabase } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await connectToDatabase();

    return jsonOk({
      database: "connected",
      dbName: mongoose.connection.name,
      latencyMs: Date.now() - startedAt,
      service: "hb-real-estate-crm",
    });
  } catch (error) {
    return Response.json(
      {
        data: {
          database: "disconnected",
          error: error instanceof Error ? error.message : "Unknown error",
          service: "hb-real-estate-crm",
        },
      },
      { status: 503 },
    );
  }
}
