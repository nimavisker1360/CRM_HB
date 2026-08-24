import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getWhatsAppMessageById } from "@/services/whatsapp/whatsapp.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const message = await getWhatsAppMessageById(id, session);
    return message ? jsonOk(message) : jsonError("WHATSAPP_MESSAGE_NOT_FOUND", "پیام پیدا نشد.", 404);
  } catch (error) {
    return handleApiError(error);
  }
}
