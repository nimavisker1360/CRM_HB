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
  templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en_US",
  testAllowedRecipients: allowedRecipients,
  testMode: boolEnv(process.env.WHATSAPP_TEST_MODE, true),
  testTemplateName: process.env.WHATSAPP_TEST_TEMPLATE_NAME?.trim() || "",
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
    webhookConfigured: Boolean(whatsappConfig.webhookVerifyToken && whatsappConfig.appSecret),
    webhookVerifyTokenConfigured: Boolean(whatsappConfig.webhookVerifyToken),
  };
}

export function isWhatsAppRecipientAllowed(normalizedPhone: string) {
  return !whatsappConfig.testMode || whatsappConfig.testAllowedRecipients.has(normalizedPhone);
}
