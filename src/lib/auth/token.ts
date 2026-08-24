import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/lib/auth/roles";

export type SessionUser = {
  agentId?: string;
  email: string;
  name: string;
  role: UserRole;
  userId: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token?: string): Promise<SessionUser | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      (payload.role !== "ADMIN" && payload.role !== "MANAGER" && payload.role !== "AGENT")
    ) {
      return null;
    }

    return {
      agentId: typeof payload.agentId === "string" ? payload.agentId : undefined,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      userId: payload.userId,
    };
  } catch {
    return null;
  }
}
