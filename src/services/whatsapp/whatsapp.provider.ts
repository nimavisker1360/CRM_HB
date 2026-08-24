import "server-only";
import { whatsappConfig } from "@/services/whatsapp/whatsapp.config";
import type { MessagingProvider, ProviderSendInput } from "@/services/whatsapp/whatsapp.types";
import { WhatsAppServiceError } from "@/services/whatsapp/whatsapp.types";

type MetaErrorBody = {
  error?: {
    code?: number;
    error_subcode?: number;
    message?: string;
    type?: string;
  };
};

export function metaPublicError(body: MetaErrorBody, status: number) {
  const code = String(body.error?.code || status || "META_ERROR");
  const subcode = String(body.error?.error_subcode || "");
  const message = (body.error?.message || "").toLowerCase();

  if (code === "190" || message.includes("token") || subcode === "463" || subcode === "467") {
    return new WhatsAppServiceError(
      "WHATSAPP_TOKEN_EXPIRED",
      "توکن آزمایشی WhatsApp منقضی شده است. یک Access Token جدید از Meta Developers ایجاد کنید.",
      502,
      code,
    );
  }
  if (code === "131030" || message.includes("recipient phone number not in allowed list")) {
    return new WhatsAppServiceError(
      "WHATSAPP_RECIPIENT_NOT_ALLOWED",
      "این شماره در فهرست گیرندگان آزمایشی Meta قرار ندارد.",
      422,
      code,
    );
  }
  if (code === "131047") {
    return new WhatsAppServiceError(
      "WHATSAPP_CONVERSATION_WINDOW_REQUIRED",
      "پنجره ۲۴ ساعته گفتگو بسته است. ابتدا قالب شروع گفتگو را بفرستید و پس از پاسخ مشتری دوباره تلاش کنید.",
      422,
      code,
    );
  }
  if (code === "131005") {
    return new WhatsAppServiceError(
      "WHATSAPP_ACCESS_DENIED",
      "Meta اجازه ارسال با این Access Token را نداد. مجوز whatsapp_business_messaging و تنظیمات شماره فرستنده را بررسی کنید.",
      422,
      code,
    );
  }
  if (["132000", "132001", "132012", "132015", "132016"].includes(code) || message.includes("template")) {
    return new WhatsAppServiceError(
      "WHATSAPP_TEMPLATE_ERROR",
      "قالب انتخاب‌شده در حساب Meta موجود یا قابل استفاده نیست.",
      422,
      code,
    );
  }
  if (code === "130429" || code === "4" || code === "80007") {
    return new WhatsAppServiceError("WHATSAPP_RATE_LIMITED", "محدودیت ارسال Meta فعال شده است؛ کمی بعد دوباره تلاش کنید.", 429, code);
  }
  return new WhatsAppServiceError("WHATSAPP_PROVIDER_ERROR", "ارسال پیام واتساپ ناموفق بود.", 502, code);
}

export class MetaWhatsAppProvider implements MessagingProvider {
  async sendMessage(input: ProviderSendInput) {
    const url = `https://graph.facebook.com/${encodeURIComponent(whatsappConfig.apiVersion)}/${encodeURIComponent(whatsappConfig.phoneNumberId)}/messages`;
    const message = input.transport === "TEMPLATE"
      ? {
          messaging_product: "whatsapp",
          to: input.to,
          type: "template",
          template: { language: { code: input.language }, name: input.templateName },
        }
      : { messaging_product: "whatsapp", recipient_type: "individual", to: input.to, type: "text", text: { body: input.text } };

    const sendPayload = async (payload: Record<string, unknown>) => {
      let response: Response;
      try {
        response = await fetch(url, {
          body: JSON.stringify(payload),
          headers: {
            Authorization: `Bearer ${whatsappConfig.accessToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        throw new WhatsAppServiceError("WHATSAPP_NETWORK_ERROR", "ارتباط با سرویس Meta برقرار نشد.", 502);
      }

      const body = (await response.json().catch(() => ({}))) as MetaErrorBody & { messages?: Array<{ id?: string }> };
      if (!response.ok) throw metaPublicError(body, response.status);
      const providerMessageId = body.messages?.[0]?.id;
      if (!providerMessageId) {
        throw new WhatsAppServiceError("WHATSAPP_INVALID_RESPONSE", "پاسخ سرویس Meta معتبر نبود.", 502);
      }
      return providerMessageId;
    };

    const providerMessageIds = [await sendPayload(message)];
    for (const media of input.media || []) {
      providerMessageIds.push(await sendPayload({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: media.type,
        [media.type]: { link: media.url },
      }));
    }

    return { providerMessageId: providerMessageIds[0], providerMessageIds, status: "SENT" as const };
  }
}

export function sanitizeMetaWebhookError(error?: { code?: number; error_data?: { details?: string }; message?: string; title?: string }) {
  const code = String(error?.code || "META_DELIVERY_FAILED");
  const normalized = `${error?.title || ""} ${error?.message || ""} ${error?.error_data?.details || ""}`.toLowerCase();
  if (code === "131030" || normalized.includes("allowed list")) return { code, message: "گیرنده آزمایشی در Meta مجاز نیست." };
  if (code === "190" || normalized.includes("token")) return { code, message: "توکن آزمایشی WhatsApp منقضی شده است." };
  if (normalized.includes("template")) return { code, message: "قالب پیام توسط Meta رد شد." };
  if (normalized.includes("rate")) return { code, message: "محدودیت نرخ ارسال Meta فعال شده است." };
  return { code, message: "تحویل پیام واتساپ ناموفق بود." };
}
