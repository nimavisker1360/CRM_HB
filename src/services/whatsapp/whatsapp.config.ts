import "server-only";
import { normalizeWhatsAppPhone } from "@/services/whatsapp/whatsapp.normalizer";

function intEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

function boolEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}

export function isPublicWhatsAppWebhookUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const privateHost = host === "localhost"
      || host === "0.0.0.0"
      || host === "::1"
      || host.startsWith("127.")
      || host.startsWith("10.")
      || host.startsWith("192.168.")
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      || host.endsWith(".local");
    return url.protocol === "https:" && !privateHost;
  } catch {
    return false;
  }
}

function resolveWhatsAppWebhookPublicUrl() {
  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const vercelDeploymentHost = process.env.VERCEL_URL?.trim();
  const candidates = [
    process.env.WHATSAPP_WEBHOOK_PUBLIC_URL?.trim(),
    process.env.APP_URL?.trim(),
    process.env.NEXTAUTH_URL?.trim(),
    vercelProductionHost ? `https://${vercelProductionHost}` : "",
    vercelDeploymentHost ? `https://${vercelDeploymentHost}` : "",
  ].filter(Boolean) as string[];
  return candidates.find(isPublicWhatsAppWebhookUrl) || candidates[0] || "";
}

const allowedRecipients = new Set(
  (process.env.WHATSAPP_TEST_ALLOWED_RECIPIENTS || "")
    .split(",")
    .map((value) => normalizeWhatsAppPhone(value))
    .filter((value): value is string => Boolean(value)),
);

export const whatsappConfig = {
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "",
  apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || "",
  appSecret: process.env.META_APP_SECRET?.trim() || "",
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || "",
  maxMessagesPerAgentPerDay: intEnv("WHATSAPP_MAX_MESSAGES_PER_AGENT_PER_DAY", 20, 1, 10_000),
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "",
  requireLocalInbound: boolEnv(process.env.WHATSAPP_REQUIRE_LOCAL_INBOUND, true),
  templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en_US",
  testAllowedRecipients: allowedRecipients,
  testMode: boolEnv(process.env.WHATSAPP_TEST_MODE, true),
  testTemplateName: process.env.WHATSAPP_TEST_TEMPLATE_NAME?.trim() || "",
  webhookPublicUrl: resolveWhatsAppWebhookPublicUrl(),
  webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || "",
} as const;

export function getWhatsAppConfigurationIssues() {
  const issues: string[] = [];
  if (!whatsappConfig.accessToken) issues.push("WHATSAPP_ACCESS_TOKEN");
  if (!whatsappConfig.phoneNumberId) issues.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!whatsappConfig.apiVersion) issues.push("WHATSAPP_API_VERSION");
  if (!whatsappConfig.testTemplateName) issues.push("WHATSAPP_TEST_TEMPLATE_NAME");
  if (whatsappConfig.testMode && whatsappConfig.testAllowedRecipients.size === 0) {
    issues.push("WHATSAPP_TEST_ALLOWED_RECIPIENTS");
  }
  return issues;
}

export function publicWhatsAppConfiguration() {
  const issues = getWhatsAppConfigurationIssues();
  const webhookPubliclyReachable = isPublicWhatsAppWebhookUrl(whatsappConfig.webhookPublicUrl);
  return {
    accessTokenConfigured: Boolean(whatsappConfig.accessToken),
    apiVersionConfigured: Boolean(whatsappConfig.apiVersion),
    businessAccountConfigured: Boolean(whatsappConfig.businessAccountId),
    configured: issues.length === 0,
    maxMessagesPerAgentPerDay: whatsappConfig.maxMessagesPerAgentPerDay,
    mode: whatsappConfig.testMode ? "TEST" : "PRODUCTION",
    phoneNumberIdConfigured: Boolean(whatsappConfig.phoneNumberId),
    provider: "Meta Cloud API",
    templateLanguage: whatsappConfig.templateLanguage,
    templateName: whatsappConfig.testTemplateName || null,
    testAllowedRecipientCount: whatsappConfig.testAllowedRecipients.size,
    testMode: whatsappConfig.testMode,
    webhookAppSecretConfigured: Boolean(whatsappConfig.appSecret),
    webhookConfigured: Boolean(whatsappConfig.webhookVerifyToken && whatsappConfig.appSecret && webhookPubliclyReachable),
    webhookPubliclyReachable,
    webhookVerifyTokenConfigured: Boolean(whatsappConfig.webhookVerifyToken),
  };
}

export function isWhatsAppRecipientAllowed(normalizedPhone: string) {
  return !whatsappConfig.testMode || whatsappConfig.testAllowedRecipients.has(normalizedPhone);
}
