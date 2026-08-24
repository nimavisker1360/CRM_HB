import { NextResponse, type NextRequest } from "next/server";
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  getGoogleOAuthConfig,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
  sanitizeAuthRedirect,
} from "@/lib/auth/google";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const origin = new URL(request.url).origin;
    const { clientId } = getGoogleOAuthConfig(origin);
    const nextPath = sanitizeAuthRedirect(request.nextUrl.searchParams.get("next"));
    const { cookieValue, state } = createGoogleOAuthState(nextPath);
    const authorizationUrl = buildGoogleAuthorizationUrl({
      clientId,
      origin,
      state: state.nonce,
    });

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, cookieValue, {
      httpOnly: true,
      maxAge: GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error(error);

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "google_config");
    return NextResponse.redirect(loginUrl);
  }
}
