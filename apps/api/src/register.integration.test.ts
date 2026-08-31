import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { runMigrationsForTests } from "./test/migrate-for-tests.js";
import { deleteFreshUserArtifacts } from "./test/integration-fixture.js";
import { withSessionCookie } from "./test/auth-helper.js";

const databaseUrl = process.env.DATABASE_URL;

const REGISTER_EMAIL = "register@test.hourden.local";
const REGISTER_PASSWORD = "RegisterPass1";
const REGISTER_WORKSPACE = "My Den";

describe.skipIf(!databaseUrl)("POST /api/auth/register", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });

  beforeAll(async () => {
    await runMigrationsForTests(pool);
  });

  beforeEach(async () => {
    await deleteFreshUserArtifacts(pool, REGISTER_EMAIL, REGISTER_WORKSPACE);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("registers a new user, auto-logs in, and reports needsOnboarding on the workspace", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: REGISTER_EMAIL,
        password: REGISTER_PASSWORD,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe(REGISTER_EMAIL);
    expect(body.activeWorkspaceId).toBeTruthy();
    expect(body.calendarTimezone).toBe("Europe/Berlin");
    expect(res.headers.get("set-cookie")).toMatch(/hourden_session=/);

    const cookie = res.headers.get("set-cookie")!.match(/hourden_session=[^;]+/)![0]!;

    const meRes = await app.request(
      "/api/auth/me",
      withSessionCookie({}, cookie),
    );
    expect(meRes.status).toBe(200);
    const me = await meRes.json();
    expect(me.user.email).toBe(REGISTER_EMAIL);
    expect(me.activeWorkspaceId).toBe(body.activeWorkspaceId);

    const onboardingRes = await app.request(
      "/api/workspace/onboarding",
      withSessionCookie({}, cookie),
    );
    expect(onboardingRes.status).toBe(200);
    expect(await onboardingRes.json()).toEqual({
      needsOnboarding: true,
      completedAt: null,
    });

    const workspace = await pool.query<{
      name: string;
      sender_name: string | null;
      calendar_timezone: string | null;
    }>(
      `
        SELECT name, sender_name, calendar_timezone
        FROM workspaces
        WHERE id = $1
      `,
      [body.activeWorkspaceId],
    );
    expect(workspace.rows[0]).toEqual({
      name: "My Den",
      sender_name: null,
      calendar_timezone: "Europe/Berlin",
    });
  });

  it("persists locale from the request body", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: REGISTER_EMAIL,
        password: REGISTER_PASSWORD,
        locale: "de",
      }),
    });

    expect(res.status).toBe(201);
    expect((await res.json()).user.locale).toBe("de");

    const stored = await pool.query<{ locale: string | null }>(
      "SELECT locale FROM users WHERE email = $1",
      [REGISTER_EMAIL],
    );
    expect(stored.rows[0]?.locale).toBe("de");
  });

  it("defaults locale from Accept-Language when body omits locale", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
      body: JSON.stringify({
        email: REGISTER_EMAIL,
        password: REGISTER_PASSWORD,
      }),
    });

    expect(res.status).toBe(201);
    expect((await res.json()).user.locale).toBe("de");
  });

  it("uses calendar timezone from the request body", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: REGISTER_EMAIL,
        password: REGISTER_PASSWORD,
        calendarTimezone: "America/New_York",
      }),
    });

    expect(res.status).toBe(201);
    expect((await res.json()).calendarTimezone).toBe("America/New_York");
  });

  it("returns 409 for duplicate email without revealing that the email exists", async () => {
    const payload = {
      email: REGISTER_EMAIL,
      password: REGISTER_PASSWORD,
    };

    const first = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);

    const second = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error).toBe("Unable to register");
    expect(JSON.stringify(body)).not.toMatch(/exists|already|duplicate/i);
  });

  it("returns 400 for weak passwords", async () => {
    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: REGISTER_EMAIL,
        password: "weak",
      }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least 8 characters/);
  });

  it("returns 400 when email or password is missing", async () => {
    const missingPassword = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: REGISTER_EMAIL }),
    });
    expect(missingPassword.status).toBe(400);

    const missingEmail = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: REGISTER_PASSWORD }),
    });
    expect(missingEmail.status).toBe(400);
  });
});
