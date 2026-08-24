import { cookies } from "next/headers";
import { signSession, verifySessionToken, type SessionUser } from "@/lib/auth/token";

export const SESSION_COOKIE = "hb_crm_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export type { SessionUser };
export { verifySessionToken };

export async function getSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }

  return session;
}

export async function setSessionCookie(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await signSession(user), getSessionCookieOptions());
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
