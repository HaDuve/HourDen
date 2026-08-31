import type { Context } from "hono";

export function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return c.req.header("cf-connecting-ip") ?? "127.0.0.1";
}
