import { jsonOk } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSessionCookie();
  return jsonOk({ loggedOut: true });
}
