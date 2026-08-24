import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { signSession } from "@/lib/auth/token";
import { authenticateGoogleUser } from "@/lib/auth/users";
import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserInfo,
  GOOGLE_OAUTH_STATE_COOKIE,
  parseGoogleOAuthStateCookie,
} from "@/lib/auth/google";

export const dynamic = "force-dynamic";

function redirectToLogin(request: NextRequest, error: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = parseGoogleOAuthStateCookie(request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value);

  if (error) return redirectToLogin(request, "google_denied");
  if (!code || !state || !storedState || state !== storedState.nonce) {
    return redirectToLogin(request, "google_state");
  }

  try {
    const origin = new URL(request.url).origin;
    const accessToken = await exchangeGoogleAuthorizationCode(code, origin);
    const profile = await fetchGoogleUserInfo(accessToken);
    const session = await authenticateGoogleUser(profile.email);

    if (!session) {
      return redirectToLogin(request, "google_user_not_found");
    }

    const response = NextResponse.redirect(new URL(storedState.nextPath, request.url));
    response.cookies.set(SESSION_COOKIE, await signSession(session), getSessionCookieOptions());
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch (oauthError) {
    console.error(oauthError);
    return redirectToLogin(request, "google_failed");
  }
}
