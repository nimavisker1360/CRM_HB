import { handleApiError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getWhatsAppConfigurationIssues, publicWhatsAppConfiguration } from "@/services/whatsapp/whatsapp.config";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await requireSession();
    requireRole(session, ["ADMIN"]);
    const issues = getWhatsAppConfigurationIssues();
    return jsonOk({
      configuration: publicWhatsAppConfiguration(),
      message: issues.length ? "تنظیمات WhatsApp کامل نیست." : "تنظیمات لازم برای اتصال Meta کامل است.",
      missing: issues,
      valid: issues.length === 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
