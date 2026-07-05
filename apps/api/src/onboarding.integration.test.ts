import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createUserWithWorkspace } from "./db/workspaces.js";
import { runMigrationsForTests } from "./test/migrate-for-tests.js";
import { withSessionCookie } from "./test/auth-helper.js";

const databaseUrl = process.env.DATABASE_URL;

const QA_EMAIL = "onboarding-qa@test.hourden.local";
const QA_PASSWORD = "QaTestPass1";
const QA_WORKSPACE = "Onboarding QA Workspace";

describe.skipIf(!databaseUrl)("workspace onboarding", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });
  let qaCookie: string;
  let qaWorkspaceId: string;

  beforeAll(async () => {
    await runMigrationsForTests(pool);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [
      QA_EMAIL,
    ]);
    await pool.query("DELETE FROM workspace_memberships WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [
      QA_EMAIL,
    ]);
    await pool.query("DELETE FROM projects WHERE workspace_id IN (SELECT id FROM workspaces WHERE name = $1)", [
      QA_WORKSPACE,
    ]);
    await pool.query("DELETE FROM clients WHERE workspace_id IN (SELECT id FROM workspaces WHERE name = $1)", [
      QA_WORKSPACE,
    ]);
    await pool.query("DELETE FROM workspaces WHERE name = $1", [QA_WORKSPACE]);
    await pool.query("DELETE FROM users WHERE email = $1", [QA_EMAIL]);

    const created = await createUserWithWorkspace(pool, {
      email: QA_EMAIL,
      password: QA_PASSWORD,
      workspaceName: QA_WORKSPACE,
    });
    qaWorkspaceId = created.workspaceId;

    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD }),
    });
    qaCookie = loginRes.headers.get("set-cookie") ?? "";
  });

  afterAll(async () => {
    await pool.end();
  });

  it("reports that a brand-new workspace needs onboarding", async () => {
    const res = await app.request(
      "/api/workspace/onboarding",
      withSessionCookie({}, qaCookie),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ needsOnboarding: true, completedAt: null });
  });

  it("marks onboarding complete when dismissed", async () => {
    const res = await app.request(
      "/api/workspace/onboarding",
      withSessionCookie(
        {
          method: "PATCH",
        },
        qaCookie,
      ),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needsOnboarding).toBe(false);
    expect(body.completedAt).toBeTruthy();

    const statusRes = await app.request(
      "/api/workspace/onboarding",
      withSessionCookie({}, qaCookie),
    );
    expect(await statusRes.json()).toEqual(body);
  });

  it("does not need onboarding when the workspace is already set up", async () => {
    await app.request(
      "/api/workspace/invoice-sender",
      withSessionCookie(
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "QA Sender GmbH",
            email: QA_EMAIL,
          }),
        },
        qaCookie,
      ),
    );

    const clientRes = await app.request(
      "/api/clients",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Bandao",
            defaultRate: 60,
          }),
        },
        qaCookie,
      ),
    );
    const client = (await clientRes.json()) as { id: string };

    await app.request(
      "/api/projects",
      withSessionCookie(
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: client.id, name: "Ondojo" }),
        },
        qaCookie,
      ),
    );

    const res = await app.request(
      "/api/workspace/onboarding",
      withSessionCookie({}, qaCookie),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      needsOnboarding: false,
      completedAt: null,
    });
  });
});
