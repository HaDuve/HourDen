import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { createApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";
import { loginAsOperator, withSessionCookie } from "./test/auth-helper.js";

const databaseUrl = process.env.DATABASE_URL;
const TEST_OPERATOR_EMAIL = "operator@test.hourden.local";
const TEST_OPERATOR_PASSWORD = "TestPass1";

describe.skipIf(!databaseUrl)("Auth API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });
  let sessionCookie: string;

  beforeAll(async () => {
    await runMigrations(pool);
    sessionCookie = await loginAsOperator(app);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM sessions WHERE user_id != (SELECT id FROM users WHERE email = $1)", [
      TEST_OPERATOR_EMAIL,
    ]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns only ok on GET /api/health without auth", async () => {
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("logs in with valid operator credentials and sets a session cookie", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_OPERATOR_EMAIL,
        password: TEST_OPERATOR_PASSWORD,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(TEST_OPERATOR_EMAIL);
    expect(body.activeWorkspaceId).toBe(DEFAULT_WORKSPACE_ID);
    expect(res.headers.get("set-cookie")).toMatch(/hourden_session=/);
  });

  it("returns the current user on GET /api/auth/me when logged in", async () => {
    const res = await app.request(
      "/api/auth/me",
      withSessionCookie({}, sessionCookie),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      user: { email: TEST_OPERATOR_EMAIL },
      activeWorkspaceId: DEFAULT_WORKSPACE_ID,
    });
  });

  it("rejects protected routes without auth", async () => {
    const res = await app.request("/api/clients");
    expect(res.status).toBe(401);
  });

  it("rejects protected routes with an invalid session cookie", async () => {
    const res = await app.request(
      "/api/clients",
      withSessionCookie({}, "hourden_session=not-a-real-session-id"),
    );
    expect(res.status).toBe(401);
  });

  it("clears the session on logout", async () => {
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_OPERATOR_EMAIL,
        password: TEST_OPERATOR_PASSWORD,
      }),
    });
    const cookie = loginRes.headers.get("set-cookie")!.match(/hourden_session=[^;]+/)![0]!;

    const logoutRes = await app.request(
      "/api/auth/logout",
      withSessionCookie({ method: "POST" }, cookie),
    );
    expect(logoutRes.status).toBe(204);

    const meRes = await app.request(
      "/api/auth/me",
      withSessionCookie({}, cookie),
    );
    expect(meRes.status).toBe(401);
  });

  it("accepts HOURDEN_API_KEY on protected routes when configured", async () => {
    const previous = process.env.HOURDEN_API_KEY;
    process.env.HOURDEN_API_KEY = "integration-test-key";

    try {
      const res = await app.request("/api/clients", {
        headers: { "x-api-key": "integration-test-key" },
      });
      expect(res.status).toBe(200);
    } finally {
      if (previous === undefined) {
        delete process.env.HOURDEN_API_KEY;
      } else {
        process.env.HOURDEN_API_KEY = previous;
      }
    }
  });
});
