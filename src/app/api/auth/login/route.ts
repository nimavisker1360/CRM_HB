import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import { setSessionCookie } from "@/lib/auth/session";
import { authenticateUser } from "@/lib/auth/users";
import { loginSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const credentials = loginSchema.parse(await request.json());
    const session = await authenticateUser(credentials.email, credentials.password);

    if (!session) {
      return jsonError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    await setSessionCookie(session);

    return jsonOk(session);
  } catch (error) {
    return handleApiError(error);
  }
}
