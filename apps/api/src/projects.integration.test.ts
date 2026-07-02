import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";

const databaseUrl = process.env.DATABASE_URL;

async function createClient(
  app: ReturnType<typeof createApp>,
  name: string,
  defaultRate = 60,
) {
  const res = await app.request("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, defaultRate }),
  });
  return res.json() as Promise<{ id: string; name: string }>;
}

describe.skipIf(!databaseUrl)("Project API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });

  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a Project with name under a Client", async () => {
    const client = await createClient(app, "Bandao");

    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, name: "Ondojo" }),
    });

    expect(res.status).toBe(201);
    const project = await res.json();
    expect(project).toMatchObject({
      clientId: client.id,
      name: "Ondojo",
      color: null,
    });
    expect(project.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("lists Projects filtered by Client", async () => {
    const bandao = await createClient(app, "Bandao");
    const hannah = await createClient(app, "Hannah");

    await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: bandao.id, name: "Ondojo" }),
    });
    await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: hannah.id, name: "Coaching" }),
    });

    const res = await app.request(`/api/projects?clientId=${bandao.id}`);
    expect(res.status).toBe(200);

    const { projects } = await res.json();
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      clientId: bandao.id,
      name: "Ondojo",
    });
  });

  it("updates a Project", async () => {
    const client = await createClient(app, "Bandao");
    const created = await (
      await app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, name: "Ondojo" }),
      })
    ).json();

    const res = await app.request(`/api/projects/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ondojo v2", color: "#3b82f6" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: created.id,
      clientId: client.id,
      name: "Ondojo v2",
      color: "#3b82f6",
    });
  });

  it("deletes a Project", async () => {
    const client = await createClient(app, "Bandao");
    const created = await (
      await app.request("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, name: "Ondojo" }),
      })
    ).json();

    const deleteRes = await app.request(`/api/projects/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const listRes = await app.request(`/api/projects?clientId=${client.id}`);
    const { projects } = await listRes.json();
    expect(projects).toHaveLength(0);
  });

  it("only returns Projects scoped to the current workspace", async () => {
    const otherWorkspaceId = "b0000000-0000-4000-8000-000000000002";
    await pool.query(
      "INSERT INTO workspaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [otherWorkspaceId, "Other Workspace"],
    );
    const foreignClient = await pool.query<{ id: string }>(
      `
        INSERT INTO clients (workspace_id, name, default_rate)
        VALUES ($1, 'Foreign Client', 50)
        RETURNING id
      `,
      [otherWorkspaceId],
    );
    await pool.query(
      `
        INSERT INTO projects (workspace_id, client_id, name)
        VALUES ($1, $2, 'Foreign Project')
      `,
      [otherWorkspaceId, foreignClient.rows[0]!.id],
    );

    const client = await createClient(app, "Bandao");
    await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, name: "Ondojo" }),
    });

    const res = await app.request("/api/projects");
    const { projects } = await res.json();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Ondojo");
  });

  it("blocks deleting a Client that still has Projects", async () => {
    const client = await createClient(app, "Bandao");
    await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, name: "Ondojo" }),
    });

    const res = await app.request(`/api/clients/${client.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Cannot delete Client with existing Projects",
    });

    const listRes = await app.request("/api/clients");
    const { clients } = await listRes.json();
    expect(clients).toHaveLength(1);
  });

  it("allows deleting a Client with no Projects", async () => {
    const client = await createClient(app, "Bandao");

    const res = await app.request(`/api/clients/${client.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(204);

    const listRes = await app.request("/api/clients");
    const { clients } = await listRes.json();
    expect(clients).toHaveLength(0);
  });

  it("returns 404 when updating a Project from another workspace", async () => {
    const otherWorkspaceId = "b0000000-0000-4000-8000-000000000002";
    await pool.query(
      "INSERT INTO workspaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [otherWorkspaceId, "Other Workspace"],
    );
    const foreignClient = await pool.query<{ id: string }>(
      `
        INSERT INTO clients (workspace_id, name, default_rate)
        VALUES ($1, 'Foreign Client', 50)
        RETURNING id
      `,
      [otherWorkspaceId],
    );
    const foreignProject = await pool.query<{ id: string }>(
      `
        INSERT INTO projects (workspace_id, client_id, name)
        VALUES ($1, $2, 'Foreign Project')
        RETURNING id
      `,
      [otherWorkspaceId, foreignClient.rows[0]!.id],
    );

    const res = await app.request(
      `/api/projects/${foreignProject.rows[0]!.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hacked" }),
      },
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting a Project from another workspace", async () => {
    const otherWorkspaceId = "b0000000-0000-4000-8000-000000000002";
    await pool.query(
      "INSERT INTO workspaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [otherWorkspaceId, "Other Workspace"],
    );
    const foreignClient = await pool.query<{ id: string }>(
      `
        INSERT INTO clients (workspace_id, name, default_rate)
        VALUES ($1, 'Foreign Client', 50)
        RETURNING id
      `,
      [otherWorkspaceId],
    );
    const foreignProject = await pool.query<{ id: string }>(
      `
        INSERT INTO projects (workspace_id, client_id, name)
        VALUES ($1, $2, 'Foreign Project')
        RETURNING id
      `,
      [otherWorkspaceId, foreignClient.rows[0]!.id],
    );

    const res = await app.request(
      `/api/projects/${foreignProject.rows[0]!.id}`,
      {
        method: "DELETE",
      },
    );

    expect(res.status).toBe(404);
  });
});
