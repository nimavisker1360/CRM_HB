import { handleApiError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { deleteAIConversation, getConversationMessages } from "@/services/ai/ai.conversation";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    return jsonOk(await getConversationMessages(session, id));
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    await deleteAIConversation(session, id);
    return jsonOk({ deleted: true });
  } catch (error) { return handleApiError(error); }
}
