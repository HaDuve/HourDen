import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { runMigrationsForTests } from "./test/migrate-for-tests.js";
import { bindSessionAuth } from "./test/auth-helper.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("Client API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = createApp({ pool });

  beforeAll(async () => {
    await runMigrationsForTests(pool);
    await bindSessionAuth(app);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM invoices");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a Client with name and default billable rate", async () => {
    const res = await app.request("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bandao", defaultRate: 60 }),
    });

    expect(res.status).toBe(201);
    const client = await res.json();
    expect(client).toMatchObject({
      name: "Bandao",
      defaultRate: 60,
      legalName: null,
      addressLine1: null,
      addressLine2: null,
    });
    expect(client.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("lists Clients in the current workspace", async () => {
    await app.request("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bandao", defaultRate: 60 }),
    });
    await app.request("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hannah", defaultRate: 80 }),
    });

    const res = await app.request("/api/clients");
    expect(res.status).toBe(200);

    const { clients } = await res.json();
    expect(clients).toHaveLength(2);
    expect(clients.map((c: { name: string }) => c.name).sort()).toEqual([
      "Bandao",
      "Hannah",
    ]);
  });

  it("updates a Client", async () => {
    const created = await (
      await app.request("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bandao", defaultRate: 60 }),
      })
    ).json();

    const res = await app.request(`/api/clients/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bandao GmbH",
        defaultRate: 65,
        legalName: "BANDAO Guidance GmbH",
        addressLine1: "Musterstraße 1",
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: created.id,
      name: "Bandao GmbH",
      defaultRate: 65,
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Musterstraße 1",
      addressLine2: null,
    });
  });

  it("deletes a Client", async () => {
    const created = await (
      await app.request("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bandao", defaultRate: 60 }),
      })
    ).json();

    const deleteRes = await app.request(`/api/clients/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    const listRes = await app.request("/api/clients");
    const { clients } = await listRes.json();
    expect(clients).toHaveLength(0);
  });

  it("only returns Clients scoped to the current workspace", async () => {
    const otherWorkspaceId = "b0000000-0000-4000-8000-000000000002";
    await pool.query(
      "INSERT INTO workspaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [otherWorkspaceId, "Other Workspace"],
    );
    await pool.query(
      `
        INSERT INTO clients (workspace_id, name, default_rate)
        VALUES ($1, 'Foreign Client', 50)
      `,
      [otherWorkspaceId],
    );

    await app.request("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Local Client", defaultRate: 60 }),
    });

    const res = await app.request("/api/clients");
    const { clients } = await res.json();

    expect(clients).toHaveLength(1);
    expect(clients[0].name).toBe("Local Client");
  });

  it("returns 404 when updating a Client from another workspace", async () => {
    const otherWorkspaceId = "b0000000-0000-4000-8000-000000000002";
    await pool.query(
      "INSERT INTO workspaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [otherWorkspaceId, "Other Workspace"],
    );
    const foreign = await pool.query<{ id: string }>(
      `
        INSERT INTO clients (workspace_id, name, default_rate)
        VALUES ($1, 'Foreign Client', 50)
        RETURNING id
      `,
      [otherWorkspaceId],
    );
    const foreignId = foreign.rows[0]!.id;

    const res = await app.request(`/api/clients/${foreignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting a Client from another workspace", async () => {
    const otherWorkspaceId = "b0000000-0000-4000-8000-000000000002";
    await pool.query(
      "INSERT INTO workspaces (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [otherWorkspaceId, "Other Workspace"],
    );
    const foreign = await pool.query<{ id: string }>(
      `
        INSERT INTO clients (workspace_id, name, default_rate)
        VALUES ($1, 'Foreign Client', 50)
        RETURNING id
      `,
      [otherWorkspaceId],
    );
    const foreignId = foreign.rows[0]!.id;

    const res = await app.request(`/api/clients/${foreignId}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });

  it("allows Recipient fields to be empty on create and filled in later", async () => {
    const created = await (
      await app.request("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hannah", defaultRate: 80 }),
      })
    ).json();

    expect(created.legalName).toBeNull();

    const updated = await (
      await app.request(`/api/clients/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: "HANNAH Coaching",
          addressLine1: "Beispielweg 2",
        }),
      })
    ).json();

    expect(updated).toMatchObject({
      legalName: "HANNAH Coaching",
      addressLine1: "Beispielweg 2",
      addressLine2: null,
    });
  });

  it("returns 400 for malformed JSON on create", async () => {
    const res = await app.request("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 for malformed JSON on update", async () => {
    const created = await (
      await app.request("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bandao", defaultRate: 60 }),
      })
    ).json();

    const res = await app.request(`/api/clients/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });
});
