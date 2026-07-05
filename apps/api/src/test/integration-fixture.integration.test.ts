import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import {
  withAuthenticatedWorkspace,
  withFreshUserWorkspace,
} from "./integration-fixture.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("integration fixture", () => {
  const workspaces: Array<{ teardown: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0).map((w) => w.teardown()));
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
