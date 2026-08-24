import { handleApiError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { listAIConversations } from "@/services/ai/ai.conversation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    return jsonOk(await listAIConversations(session));
  } catch (error) { return handleApiError(error); }
}
