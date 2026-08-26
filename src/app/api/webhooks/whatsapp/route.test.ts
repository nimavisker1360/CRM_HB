import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processMetaWebhook: vi.fn(),
  verifyMetaWebhookSignature: vi.fn(),
}));

vi.mock("@/services/whatsapp/whatsapp.config", () => ({
  whatsappConfig: {
    appSecret: "app-secret",
    webhookVerifyToken: "verify-token",
  },
}));

vi.mock("@/services/whatsapp/whatsapp.webhook", () => mocks);

import { GET, POST } from "@/app/api/webhooks/whatsapp/route";

describe("Meta WhatsApp webhook route", () => {
  beforeEach(() => {
    mocks.processMetaWebhook.mockReset().mockResolvedValue({ events: 1 });
    mocks.verifyMetaWebhookSignature.mockReset().mockReturnValue(true);
  });

  it("returns the Meta verification challenge for the configured token", async () => {
    const response = await GET(new Request(
      "https://crm.example.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge-123",
    ));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("challenge-123");
  });

  it("rejects an invalid verification token", async () => {
    const response = await GET(new Request(
      "https://crm.example.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123",
    ));

    expect(response.status).toBe(403);
  });

  it("verifies the raw payload signature before processing status updates", async () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const response = await POST(new Request("https://crm.example.com/api/webhooks/whatsapp", {
      body,
      headers: { "x-hub-signature-256": "sha256=valid" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(mocks.verifyMetaWebhookSignature).toHaveBeenCalledWith(body, "sha256=valid");
    expect(mocks.processMetaWebhook).toHaveBeenCalledWith(JSON.parse(body));
  });

  it("rejects unsigned or invalid payloads", async () => {
    mocks.verifyMetaWebhookSignature.mockReturnValue(false);
    const response = await POST(new Request("https://crm.example.com/api/webhooks/whatsapp", {
      body: JSON.stringify({ object: "whatsapp_business_account" }),
      method: "POST",
    }));

    expect(response.status).toBe(401);
    expect(mocks.processMetaWebhook).not.toHaveBeenCalled();
  });
});
