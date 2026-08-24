import { handleApiError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getPublicWhatsAppConfiguration } from "@/services/whatsapp/whatsapp.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession();
    return jsonOk(getPublicWhatsAppConfiguration());
  } catch (error) {
    return handleApiError(error);
  }
}
