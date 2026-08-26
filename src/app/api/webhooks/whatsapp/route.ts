import { jsonError, jsonOk } from "@/lib/api";
import type { MetaWebhookPayload } from "@/services/whatsapp/whatsapp.types";
import { whatsappConfig } from "@/services/whatsapp/whatsapp.config";
import {
  processMetaWebhook,
  verifyMetaWebhookSignature,
} from "@/services/whatsapp/whatsapp.webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (
    mode === "subscribe"
    && challenge
    && whatsappConfig.webhookVerifyToken
    && token === whatsappConfig.webhookVerifyToken
  ) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Webhook verification failed.", { status: 403 });
}

export async function POST(request: Request) {
  if (!whatsappConfig.appSecret) {
    return jsonError("WEBHOOK_NOT_CONFIGURED", "Webhook is not configured.", 503);
  }

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
