export function isValidCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
  const headerSecret = request.headers.get("x-cron-secret");

  return bearer === secret || headerSecret === secret;
}
