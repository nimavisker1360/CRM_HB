import { randomBytes } from "crypto";

export const GOOGLE_OAUTH_STATE_COOKIE = "hb_google_oauth_state";
export const GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfoResponse = {
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  sub?: string;
};

export type GoogleOAuthState = {
  nextPath: string;
  nonce: string;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function sanitizeAuthRedirect(value: string | null) {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}

export function getGoogleOAuthConfig(origin: string) {
  const clientId = process.env.AUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.AUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || origin;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials are not configured.");
  }

  return {
    clientId,
    clientSecret,
    redirectUri: new URL("/api/auth/google/callback", appUrl).toString(),
  };
}

export function createGoogleOAuthState(nextPath: string) {
  const state: GoogleOAuthState = {
    nextPath,
    nonce: randomBytes(32).toString("base64url"),
  };

  return {
    cookieValue: `${state.nonce}.${base64UrlEncode(state.nextPath)}`,
    state,
  };
}

export function parseGoogleOAuthStateCookie(value?: string) {
  if (!value) return null;

  const separatorIndex = value.indexOf(".");
  if (separatorIndex <= 0) return null;

  try {
    return {
      nextPath: sanitizeAuthRedirect(base64UrlDecode(value.slice(separatorIndex + 1))),
      nonce: value.slice(0, separatorIndex),
    };
  } catch {
    return null;
  }
}

export function buildGoogleAuthorizationUrl({
  clientId,
  origin,
  state,
}: {
  clientId: string;
  origin: string;
  state: string;
}) {
  const { redirectUri } = getGoogleOAuthConfig(origin);
  const url = new URL(GOOGLE_AUTHORIZATION_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("include_granted_scopes", "true");

  return url;
}

export async function exchangeGoogleAuthorizationCode(code: string, origin: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(origin);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  const token = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "GOOGLE_TOKEN_EXCHANGE_FAILED");
  }

  return token.access_token;
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = (await response.json()) as GoogleUserInfoResponse;

  if (!response.ok || !profile.email) {
    throw new Error("GOOGLE_PROFILE_FAILED");
  }

  if (profile.email_verified === false || profile.email_verified === "false") {
    throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");
  }

  return {
    email: profile.email.toLowerCase(),
    name: profile.name || profile.email,
    providerAccountId: profile.sub,
  };
}
