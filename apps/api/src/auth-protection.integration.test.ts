import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createAuthRateLimiters, DEFAULT_AUTH_RATE_LIMITS } from "./auth/protection.js";
import { runMigrationsForTests } from "./test/migrate-for-tests.js";
import { deleteFreshUserArtifacts } from "./test/integration-fixture.js";
import {
  TEST_OPERATOR_EMAIL,
  TEST_OPERATOR_PASSWORD,
} from "./test/operator-credentials.js";

const databaseUrl = process.env.DATABASE_URL;

const REGISTER_PASSWORD = "RegisterPass1";
const VALID_TURNSTILE_TOKEN = "valid-turnstile-token";

function registerHeaders(ip: string) {
  return {
    "Content-Type": "application/json",
    "x-forwarded-for": ip,
  };
}

function registerBody(email: string, turnstileToken = VALID_TURNSTILE_TOKEN) {
  return JSON.stringify({
    email,
    password: REGISTER_PASSWORD,
    turnstileToken,
  });
}

function createProtectedApp(
  pool: Pool,
  options?: {
    verifyTurnstile?: (token: string, remoteIp: string) => Promise<boolean>;
    rateLimiters?: ReturnType<typeof createAuthRateLimiters>;
  },
) {
  return createApp({
    pool,
    auth: {
      verifyTurnstile: options?.verifyTurnstile ?? (async () => true),
      rateLimiters:
        options?.rateLimiters ?? createAuthRateLimiters(DEFAULT_AUTH_RATE_LIMITS),
    },
  });
}

describe.skipIf(!databaseUrl)("Auth protection", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const testIp = "203.0.113.10";

  beforeAll(async () => {
    await runMigrationsForTests(pool);
  });

  beforeEach(async () => {
    await deleteFreshUserArtifacts(
      pool,
      "captcha-fail@test.hourden.local",
      "My Den",
    );
    await deleteFreshUserArtifacts(pool, "rate-email@test.hourden.local", "My Den");
    for (const email of [
      "rate-ip-0@test.hourden.local",
      "rate-ip-1@test.hourden.local",
      "rate-ip-blocked@test.hourden.local",
    ]) {
      await deleteFreshUserArtifacts(pool, email, "My Den");
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns 400 when turnstile token is missing and does not create a user", async () => {
    const email = "captcha-fail@test.hourden.local";
    const app = createProtectedApp(pool);

    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: registerHeaders(testIp),
      body: JSON.stringify({
        email,
        password: REGISTER_PASSWORD,
      }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Verification failed");

    const users = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    expect(users.rowCount).toBe(0);
  });

  it("returns 400 when turnstile verification fails and does not create a user", async () => {
    const email = "captcha-fail@test.hourden.local";
    const app = createProtectedApp(pool, {
      verifyTurnstile: async () => false,
    });

    const res = await app.request("/api/auth/register", {
      method: "POST",
      headers: registerHeaders(testIp),
      body: registerBody(email),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Verification failed");

    const users = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    expect(users.rowCount).toBe(0);
  });

  it("returns 429 when register IP rate limit is exceeded", async () => {
    const app = createProtectedApp(pool, {
      rateLimiters: createAuthRateLimiters({
        registerIp: { limit: 2, windowMs: 60 * 60 * 1000 },
        registerEmail: { limit: 10, windowMs: 24 * 60 * 60 * 1000 },
        loginIp: { limit: 20, windowMs: 15 * 60 * 1000 },
      }),
    });

    for (let i = 0; i < 2; i++) {
      const res = await app.request("/api/auth/register", {
        method: "POST",
        headers: registerHeaders(testIp),
        body: registerBody(`rate-ip-${i}@test.hourden.local`),
      });
      expect(res.status).toBe(201);
    }

    const blocked = await app.request("/api/auth/register", {
      method: "POST",
      headers: registerHeaders(testIp),
      body: registerBody("rate-ip-blocked@test.hourden.local"),
    });

    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe("Too many requests");
  });

  it("returns 429 when register email rate limit is exceeded", async () => {
    const email = "rate-email@test.hourden.local";
    const app = createProtectedApp(pool, {
      rateLimiters: createAuthRateLimiters({
        registerIp: { limit: 10, windowMs: 60 * 60 * 1000 },
        registerEmail: { limit: 2, windowMs: 24 * 60 * 60 * 1000 },
        loginIp: { limit: 20, windowMs: 15 * 60 * 1000 },
      }),
    });

    const first = await app.request("/api/auth/register", {
      method: "POST",
      headers: registerHeaders("203.0.113.20"),
      body: registerBody(email),
    });
    expect(first.status).toBe(201);

    const duplicate = await app.request("/api/auth/register", {
      method: "POST",
      headers: registerHeaders("203.0.113.21"),
      body: registerBody(email),
    });
    expect(duplicate.status).toBe(409);

    const blocked = await app.request("/api/auth/register", {
      method: "POST",
      headers: registerHeaders("203.0.113.99"),
      body: registerBody(email),
    });

    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe("Too many requests");
  });

  it("returns 429 when login IP rate limit is exceeded without requiring CAPTCHA", async () => {
    const app = createProtectedApp(pool, {
      rateLimiters: createAuthRateLimiters({
        registerIp: { limit: 5, windowMs: 60 * 60 * 1000 },
        registerEmail: { limit: 3, windowMs: 24 * 60 * 60 * 1000 },
        loginIp: { limit: 2, windowMs: 15 * 60 * 1000 },
      }),
    });

    for (let i = 0; i < 2; i++) {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: registerHeaders(testIp),
        body: JSON.stringify({
          email: TEST_OPERATOR_EMAIL,
          password: TEST_OPERATOR_PASSWORD,
        }),
      });
      expect(res.status).toBe(200);
    }

    const blocked = await app.request("/api/auth/login", {
      method: "POST",
      headers: registerHeaders(testIp),
      body: JSON.stringify({
        email: TEST_OPERATOR_EMAIL,
        password: TEST_OPERATOR_PASSWORD,
      }),
    });

    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe("Too many requests");
  });
});
