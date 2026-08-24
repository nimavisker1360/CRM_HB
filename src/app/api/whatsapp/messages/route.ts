import { z } from "zod";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getAgentScope, resolveRequestedAgentId } from "@/lib/auth/agent-scope";
import { requireSession } from "@/lib/auth/session";
import { getWhatsAppMessages, sendWhatsAppMessage } from "@/services/whatsapp/whatsapp.service";
import { WHATSAPP_MESSAGE_TYPES, WhatsAppServiceError } from "@/services/whatsapp/whatsapp.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sendSchema = z.object({
  clientRequestId: z.string().min(12).max(128),
  customerId: z.string().min(1),
  followUpId: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
  matchId: z.string().optional(),
  messageType: z.enum(WHATSAPP_MESSAGE_TYPES),
  propertyId: z.string().optional(),
  templateName: z.string().max(512).optional(),
  text: z.string().max(4096).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const scope = getAgentScope(session, resolveRequestedAgentId(searchParams));
    return jsonOk(await getWhatsAppMessages(searchParams, session, scope));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const input = sendSchema.parse(await request.json());
    return jsonOk(await sendWhatsAppMessage(input, session), { status: 201 });
  } catch (error) {
    if (error instanceof WhatsAppServiceError) {
      return jsonError(error.code, error.publicMessage, error.httpStatus);
    }
    return handleApiError(error);
  }
}
