import { ZodError } from "zod";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return Response.json({ success: true, data }, init);
}

export function jsonError(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return Response.json(
    { success: false, error: { code, message, details } },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError("VALIDATION_FAILED", "Validation failed.", 422, error.flatten());
  }

  if (error instanceof Error) {
    console.error(error);

    if (error.message === "UNAUTHENTICATED") {
      return jsonError("UNAUTHENTICATED", "Authentication is required.", 401);
    }

    if (error.message === "FORBIDDEN") {
      return jsonError("FORBIDDEN", "You do not have access to this action.", 403);
    }

    if (error.message.includes("duplicate key")) {
      return jsonError("DUPLICATE_KEY", "A record with this unique value already exists.", 409);
    }

    return jsonError("SERVER_ERROR", "Unexpected server error.", 500);
  }

  return jsonError("SERVER_ERROR", "Unexpected server error.", 500);
}
