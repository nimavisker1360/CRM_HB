import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("WhatsApp security and normalization", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("normalizes an explicit international phone without guessing a country", async () => {
    const { normalizeWhatsAppPhone } = await import("@/services/whatsapp/whatsapp.normalizer");
    expect(normalizeWhatsAppPhone("+90 552 607 89 00")).toBe("905526078900");
    expect(normalizeWhatsAppPhone("0552 607 89 00")).toBeNull();
    expect(normalizeWhatsAppPhone("not-a-phone")).toBeNull();
  });

  it("never exposes secrets in the public configuration", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "super-secret-access-token");
    vi.stubEnv("META_APP_SECRET", "super-secret-app-secret");
    vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "super-secret-verify-token");
    const { publicWhatsAppConfiguration } = await import("@/services/whatsapp/whatsapp.config");
    const serialized = JSON.stringify(publicWhatsAppConfiguration());
    expect(serialized).not.toContain("super-secret-access-token");
    expect(serialized).not.toContain("super-secret-app-secret");
    expect(serialized).not.toContain("super-secret-verify-token");
    expect(publicWhatsAppConfiguration().accessTokenConfigured).toBe(true);
  });

  it("does not report localhost as a configured Meta webhook", async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("META_APP_SECRET", "app-secret");
    vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "verify-token");
    const { isPublicWhatsAppWebhookUrl, publicWhatsAppConfiguration } = await import("@/services/whatsapp/whatsapp.config");
    expect(isPublicWhatsAppWebhookUrl("http://localhost:3000/api/webhooks/whatsapp")).toBe(false);
    expect(isPublicWhatsAppWebhookUrl("https://crm.example.com/api/webhooks/whatsapp")).toBe(true);
    expect(publicWhatsAppConfiguration().webhookConfigured).toBe(false);
  });

  it("uses the Vercel production domain for the public webhook", async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("META_APP_SECRET", "app-secret");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "crm-production.vercel.app");
    vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "verify-token");
    const { publicWhatsAppConfiguration, whatsappConfig } = await import("@/services/whatsapp/whatsapp.config");
    expect(whatsappConfig.webhookPublicUrl).toBe("https://crm-production.vercel.app");
    expect(publicWhatsAppConfiguration().webhookConfigured).toBe(true);
  });

  it("verifies Meta sha256 signatures", async () => {
    const { createHmac } = await import("node:crypto");
    const { verifySha256Signature } = await import("@/services/whatsapp/whatsapp.signature");
    const payload = JSON.stringify({ object: "whatsapp_business_account" });
    const signature = `sha256=${createHmac("sha256", "test-secret").update(payload).digest("hex")}`;
    expect(verifySha256Signature(payload, signature, "test-secret")).toBe(true);
    expect(verifySha256Signature(`${payload}x`, signature, "test-secret")).toBe(false);
  });

  it("maps supported Meta statuses and ignores unknown ones", async () => {
    const { canApplyWhatsAppStatus, mapMetaStatus } = await import("@/services/whatsapp/whatsapp.status");
    expect(mapMetaStatus("sent")).toBe("SENT");
    expect(mapMetaStatus("delivered")).toBe("DELIVERED");
    expect(mapMetaStatus("read")).toBe("READ");
    expect(mapMetaStatus("failed")).toBe("FAILED");
    expect(mapMetaStatus("deleted")).toBeNull();
    expect(canApplyWhatsAppStatus("DELIVERED", "READ")).toBe(true);
    expect(canApplyWhatsAppStatus("READ", "DELIVERED")).toBe(false);
  });

  it("sanitizes expired-token and test-recipient provider failures", async () => {
    const { metaPublicError } = await import("@/services/whatsapp/whatsapp.provider");
    const expired = metaPublicError({ error: { code: 190, message: "raw provider token details" } }, 401);
    const recipient = metaPublicError({ error: { code: 131030 } }, 400);
    expect(expired.code).toBe("WHATSAPP_TOKEN_EXPIRED");
    expect(expired.publicMessage).not.toContain("raw provider token details");
    expect(recipient.code).toBe("WHATSAPP_RECIPIENT_NOT_ALLOWED");
  });

  it("maps Meta conversation-window and access-denied failures", async () => {
    const { metaPublicError } = await import("@/services/whatsapp/whatsapp.provider");
    const conversationWindow = metaPublicError({ error: { code: 131047 } }, 400);
    const accessDenied = metaPublicError({ error: { code: 131005 } }, 400);
    expect(conversationWindow.code).toBe("WHATSAPP_CONVERSATION_WINDOW_REQUIRED");
    expect(accessDenied.code).toBe("WHATSAPP_ACCESS_DENIED");
  });

  it("sends the real property preview before its image and video messages", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "test-access-token");
    vi.stubEnv("WHATSAPP_API_VERSION", "v23.0");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123456");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: "wamid.template" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: "wamid.image" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: "wamid.video" }] }), { status: 200 }));
    const { MetaWhatsAppProvider } = await import("@/services/whatsapp/whatsapp.provider");

    const result = await new MetaWhatsAppProvider().sendMessage({
      language: "fa",
      media: [
        { type: "image", url: "https://example.public.blob.vercel-storage.com/property.jpg" },
        { type: "video", url: "https://example.public.blob.vercel-storage.com/property.mp4" },
      ],
      text: "Property recommendation preview",
      to: "905551111111",
      transport: "TEXT",
    });

    expect(result.providerMessageIds).toEqual(["wamid.template", "wamid.image", "wamid.video"]);
    expect(result.status).toBe("QUEUED");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      text: { body: "Property recommendation preview" },
      type: "text",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      image: { link: "https://example.public.blob.vercel-storage.com/property.jpg" },
      type: "image",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      type: "video",
      video: { link: "https://example.public.blob.vercel-storage.com/property.mp4" },
    });
  });

  it("enforces the test allowlist and WhatsApp agent ownership", async () => {
    vi.stubEnv("WHATSAPP_TEST_MODE", "true");
    vi.stubEnv("WHATSAPP_TEST_ALLOWED_RECIPIENTS", "+90 552 607 89 00");
    const { isWhatsAppRecipientAllowed } = await import("@/services/whatsapp/whatsapp.config");
    const { canAccessWhatsAppMessage } = await import("@/services/whatsapp/whatsapp.access");
    const agent = { agentId: "agent-a", email: "a@example.com", name: "Agent A", role: "AGENT" as const, userId: "user-a" };
    const admin = { email: "admin@example.com", name: "Admin", role: "ADMIN" as const, userId: "admin" };
    expect(isWhatsAppRecipientAllowed("905526078900")).toBe(true);
    expect(isWhatsAppRecipientAllowed("905551111111")).toBe(false);
    expect(canAccessWhatsAppMessage(agent, { agentId: "agent-a" })).toBe(true);
    expect(canAccessWhatsAppMessage(agent, { agentId: "agent-b" })).toBe(false);
    expect(canAccessWhatsAppMessage(admin, { agentId: "agent-b" })).toBe(true);
  });
});
