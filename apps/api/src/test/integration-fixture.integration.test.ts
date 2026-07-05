import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { bindSessionAuth } from "./auth-helper.js";
import { runMigrationsForTests } from "./migrate-for-tests.js";
import { TEST_OPERATOR_EMAIL } from "./operator-credentials.js";
import {
  withAuthenticatedWorkspace,
  withFreshUserWorkspace,
} from "./integration-fixture.js";
import { resetWorkspace } from "./reset-workspace.js";

const databaseUrl = process.env.DATABASE_URL;

async function operatorSessionCount(pool: Pool): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM sessions
      WHERE user_id IN (SELECT id FROM users WHERE email = $1)
    `,
    [TEST_OPERATOR_EMAIL],
  );
  return Number(result.rows[0]!.count);
}

async function operatorClientCount(pool: Pool): Promise<number> {
  const result = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM clients WHERE workspace_id = $1",
    [DEFAULT_WORKSPACE_ID],
  );
  return Number(result.rows[0]!.count);
}

describe.skipIf(!databaseUrl)("integration fixture", () => {
  const workspaces: Array<{ teardown: () => Promise<void> }> = [];
  let cleanupPool: Pool;

  beforeAll(async () => {
    cleanupPool = new Pool({ connectionString: databaseUrl });
    await runMigrationsForTests(cleanupPool);
  });

  beforeEach(async () => {
    await resetWorkspace(cleanupPool, DEFAULT_WORKSPACE_ID);
  });

  afterEach(async () => {
    await Promise.all(workspaces.splice(0).map((w) => w.teardown()));
  });

  afterAll(async () => {
    await resetWorkspace(cleanupPool, DEFAULT_WORKSPACE_ID);
    expect(await operatorClientCount(cleanupPool)).toBe(0);
    await cleanupPool.end();
  });

  it("bindSessionAuth returns the single session it binds", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await runMigrationsForTests(pool);
      const app = createApp({ pool });
      const countBefore = await operatorSessionCount(pool);

      const sessionCookie = await bindSessionAuth(app);

      expect(await operatorSessionCount(pool) - countBefore).toBe(1);
      expect(sessionCookie).toMatch(/^hourden_session=/);
      expect(await app.request("/api/auth/me")).toMatchObject({ status: 200 });
    } finally {
      await pool.end();
    }
  });

  it("withAuthenticatedWorkspace exposes the bound session cookie", async () => {
    const workspace = await withAuthenticatedWorkspace("api");
    workspaces.push(workspace);

    const cookieSessionId = workspace.sessionCookie.match(/hourden_session=(.+)/)?.[1];
    expect(cookieSessionId).toBeTruthy();

    const sessionRow = await workspace.pool.query<{ id: string }>(
      "SELECT id FROM sessions WHERE id = $1",
      [cookieSessionId],
    );
    expect(sessionRow.rows).toHaveLength(1);

    const res = await workspace.app.request("/api/auth/me");
    expect(res.status).toBe(200);
  });

  it("withAuthenticatedWorkspace(api) exposes session-bound app.request", async () => {
    const workspace = await withAuthenticatedWorkspace("api");
    workspaces.push(workspace);

    expect(workspace.pool).toBeInstanceOf(Pool);
    expect(workspace.sessionCookie).toMatch(/^hourden_session=/);

    const res = await workspace.app.request("/api/clients");
    expect(res.status).toBe(200);
  });

  it("withAuthenticatedWorkspace(web) proxies fetch to the same pool and session", async () => {
    const workspace = await withAuthenticatedWorkspace("web");
    workspaces.push(workspace);

    const res = await fetch("/api/clients");
    expect(res.status).toBe(200);

    const postRes = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Fixture Client", defaultRate: 60 }),
    });
    expect(postRes.status).toBe(201);
    const body = await postRes.json();
    expect(body.name).toBe("Fixture Client");
  });

  it("teardown restores fetch before ending the pool", async () => {
    const workspace = await withAuthenticatedWorkspace("web");

    await workspace.teardown();

    await expect(fetch("/api/clients")).rejects.toThrow(/parse URL/i);
  });

  it("withFreshUserWorkspace(web) authenticates a newly created user", async () => {
    const email = "fixture-fresh-user@test.hourden.local";
    const password = "QaTestPass1";
    const workspaceName = "Fixture Fresh Workspace";

    const workspace = await withFreshUserWorkspace("web", {
      email,
      password,
      workspaceName,
    });
    workspaces.push(workspace);

    const res = await fetch("/api/workspace/onboarding");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ needsOnboarding: true, completedAt: null });
    expect(workspace.workspaceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
