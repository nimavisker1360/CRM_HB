import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { aiChatRequestSchema } from "@/services/ai/ai.schemas";
import { chatWithAI } from "@/services/ai/ai.service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const input = aiChatRequestSchema.parse(await request.json());
    return jsonOk(await chatWithAI(session, input));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "AI_PROVIDER_NOT_CONFIGURED") return jsonError("AI_PROVIDER_NOT_CONFIGURED", "دستیار هوشمند در حال حاضر در دسترس نیست.", 503);
      if (error.message === "AI_RATE_LIMITED") return jsonError("AI_RATE_LIMITED", "تعداد درخواست‌ها زیاد است. لطفاً کمی صبر کنید.", 429);
      if (error.message === "AI_DAILY_LIMIT_REACHED") return jsonError("AI_DAILY_LIMIT_REACHED", "سقف استفاده روزانه دستیار هوشمند برای امروز تکمیل شده است.", 429);
      if (error.message === "AI_MESSAGE_TOO_LONG") return jsonError("AI_MESSAGE_TOO_LONG", "پیام برای پردازش بیش از حد طولانی است.", 422);
      if (error.message === "CONVERSATION_SCOPE_MISMATCH") return jsonError("CONVERSATION_SCOPE_MISMATCH", "این گفتگو متعلق به محدوده کاری دیگری است.", 403);
      if (error.message === "AI_MALFORMED_RESPONSE" || error.message === "AI_PROVIDER_UNSUPPORTED") return jsonError("AI_UNAVAILABLE", "دستیار هوشمند در حال حاضر در دسترس نیست. لطفاً دوباره تلاش کنید.", 503);
    }
    return handleApiError(error);
  }
}
