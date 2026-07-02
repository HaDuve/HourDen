import type { Context, Next } from "hono";

export async function apiKeyAuth(c: Context, next: Next) {
  const configuredKey = process.env.HOURDEN_API_KEY;

  if (!configuredKey) {
    return next();
  }

  const provided =
    c.req.header("x-api-key") ??
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "");

  if (provided !== configuredKey) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return next();
}
