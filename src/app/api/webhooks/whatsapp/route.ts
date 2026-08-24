import { jsonError, jsonOk } from "@/lib/api";
import { whatsappConfig } from "@/services/whatsapp/whatsapp.config";
import { processMetaWebhook, verifyMetaWebhookSignature } from "@/services/whatsapp/whatsapp.webhook";
import type { MetaWebhookPayload } from "@/services/whatsapp/whatsapp.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && challenge && whatsappConfig.webhookVerifyToken && token === whatsappConfig.webhookVerifyToken) {
    return new Response(challenge, { headers: { "Content-Type": "text/plain" }, status: 200 });
  }
  return jsonError("WEBHOOK_VERIFICATION_FAILED", "Webhook verification failed.", 403);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyMetaWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return jsonError("INVALID_WEBHOOK_SIGNATURE", "Invalid webhook signature.", 401);
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return jsonError("INVALID_WEBHOOK_PAYLOAD", "Invalid webhook payload.", 400);
  }
  if (payload.object !== "whatsapp_business_account") {
    return jsonError("INVALID_WEBHOOK_OBJECT", "Unsupported webhook object.", 400);
  }

  try {
    return jsonOk(await processMetaWebhook(payload));
  } catch (error) {
    console.error("[whatsapp:webhook]", error instanceof Error ? error.message : "Unknown webhook error");
    return jsonError("WEBHOOK_PROCESSING_FAILED", "Webhook processing failed.", 500);
  }
}
