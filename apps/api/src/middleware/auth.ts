import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { Pool } from "pg";
import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import {
  findSessionById,
  hasMembership,
  touchSession,
} from "../db/auth.js";
import { SESSION_COOKIE, isSessionExpired, sessionExpiresAt } from "../auth/session.js";
import { runWithWorkspaceId } from "../workspace.js";

function isPublicPath(path: string, method: string): boolean {
  if (path === "/health" || path === "/api/health") {
    return method === "GET";
  }
  if (path === "/api/auth/login" && method === "POST") {
    return true;
  }
  return false;
}

function apiKeyMatches(c: Context): boolean {
  const configuredKey = process.env.HOURDEN_API_KEY;
  if (!configuredKey) {
    return false;
  }

  const provided =
    c.req.header("x-api-key") ??
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "");

  return provided === configuredKey;
}

export function createAuthMiddleware(pool: Pool) {
  return async function authMiddleware(c: Context, next: Next) {
    const path = c.req.path;
    const method = c.req.method;

    if (isPublicPath(path, method)) {
      return next();
    }

    if (apiKeyMatches(c)) {
      return runWithWorkspaceId(DEFAULT_WORKSPACE_ID, () => next());
    }

    const sessionId = getCookie(c, SESSION_COOKIE);
    if (!sessionId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const session = await findSessionById(pool, sessionId);
    if (!session || isSessionExpired(session.expires_at)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const allowed = await hasMembership(
      pool,
      session.user_id,
      session.active_workspace_id,
    );
    if (!allowed) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const expiresAt = sessionExpiresAt();
    await touchSession(pool, session.id, expiresAt);

    return runWithWorkspaceId(session.active_workspace_id, () => next());
  };
}
