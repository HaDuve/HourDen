import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Pool } from "pg";
import {
  createSession,
  deleteSession,
  findOwnerWorkspaceIdForUser,
  findUserByEmail,
} from "../db/auth.js";
import {
  findUserIdBySessionId,
  updateUserLocale,
} from "../db/users.js";
import { getWorkspaceCalendarTimezone } from "../db/workspaces.js";
import { isSupportedLocale, parseAcceptLanguage } from "@hourden/domain";
import { verifyPassword } from "./password.js";
import { SESSION_COOKIE, sessionExpiresAt } from "./session.js";

function cookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "Lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: sessionExpiresAt(),
  };
}

export function createAuthRouter(pool: Pool) {
  const router = new Hono();

  router.post("/login", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>();
    const email = body.email?.trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const user = await findUserByEmail(pool, email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const workspaceId = await findOwnerWorkspaceIdForUser(pool, user.id);
    if (!workspaceId) {
      return c.json({ error: "No workspace membership" }, 403);
    }

    const calendarTimezone = await getWorkspaceCalendarTimezone(pool, workspaceId);

    let locale = user.locale ?? null;
    if (!locale) {
      locale = parseAcceptLanguage(c.req.header("accept-language"));
      await updateUserLocale(pool, user.id, locale);
    }

    const sessionId = await createSession(pool, {
      userId: user.id,
      activeWorkspaceId: workspaceId,
      expiresAt: sessionExpiresAt(),
    });

    setCookie(c, SESSION_COOKIE, sessionId, cookieOptions());

    return c.json({
      user: { id: user.id, email: user.email, locale },
      activeWorkspaceId: workspaceId,
      calendarTimezone,
    });
  });

  router.patch("/locale", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (!sessionId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = await findUserIdBySessionId(pool, sessionId);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let body: { locale?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!isSupportedLocale(body.locale)) {
      return c.json({ error: "locale must be en or de" }, 400);
    }

    const locale = await updateUserLocale(pool, userId, body.locale);
    return c.json({ locale });
  });

  router.post("/logout", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (sessionId) {
      await deleteSession(pool, sessionId);
    }

    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

  router.get("/me", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (!sessionId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const session = await pool.query<{
      id: string;
      email: string;
      locale: string | null;
      active_workspace_id: string;
    }>(
      `
        SELECT u.id, u.email, u.locale, s.active_workspace_id
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = $1
      `,
      [sessionId],
    );

    const row = session.rows[0];
    if (!row) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const calendarTimezone = await getWorkspaceCalendarTimezone(
      pool,
      row.active_workspace_id,
    );

    return c.json({
      user: { id: row.id, email: row.email, locale: row.locale },
      activeWorkspaceId: row.active_workspace_id,
      calendarTimezone,
    });
  });

  return router;
}
