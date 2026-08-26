import { describe, expect, it } from "vitest";
import { unstable_doesProxyMatch } from "next/experimental/testing/server";
import { config } from "@/proxy";

describe("proxy matcher", () => {
  it("does not run authentication for the Meta webhook", () => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: "/api/webhooks/whatsapp" })).toBe(false);
  });

  it("does not run authentication for health checks", () => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: "/api/health" })).toBe(false);
  });

  it("continues to protect private application routes", () => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: "/dashboard" })).toBe(true);
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: "/api/customers" })).toBe(true);
  });
});
