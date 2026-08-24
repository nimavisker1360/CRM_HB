import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySha256Signature(rawBody: string, signature: string | null, appSecret: string) {
  if (!appSecret) return true;
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
