import "./load-env.js";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupAuthenticatedApiFetch } from "./authenticated-api.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("authenticated fetch proxy in jsdom", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let restoreFetch: () => void;

  beforeAll(async () => {
    ({ restoreFetch } = await setupAuthenticatedApiFetch(pool));
  });

  afterAll(async () => {
    restoreFetch();
    await pool.end();
  });

  it("reads preview errors and PDF blobs through proxied fetch", async () => {
    const clientRes = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hannah", defaultRate: 80 }),
    });
    expect(clientRes.status).toBe(201);
    const client = (await clientRes.json()) as { id: string };

    const errorRes = await fetch("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });
    expect(errorRes.status).toBe(400);
    const errorBody = (await errorRes.json()) as { error?: string };
    expect(errorBody.error).toMatch(/recipient fields are required/i);

    const recipientRes = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bandao",
        defaultRate: 60,
        legalName: "BANDAO Guidance GmbH",
        addressLine1: "Schloßbergstraße 1",
        addressLine2: "82319 Starnberg",
      }),
    });
    const bandao = (await recipientRes.json()) as { id: string };

    const projectRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: bandao.id, name: "Ondojo" }),
    });
    const project = (await projectRes.json()) as { id: string };

    await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });

    const previewRes = await fetch("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: bandao.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    expect(previewRes.status).toBe(200);
    const blob = await previewRes.blob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
