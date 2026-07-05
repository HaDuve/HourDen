import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { runMigrationsForTests } from "./test/migrate-for-tests.js";
import { bindSessionAuth } from "./test/auth-helper.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("fetch proxy for web integration tests", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let restoreFetch: () => void;

  beforeAll(async () => {
    vi.unstubAllGlobals();
    await runMigrationsForTests(pool);

    const app = createApp({ pool });
    await bindSessionAuth(app);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (url.startsWith("/api/")) {
        return app.request(url, init);
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    restoreFetch = () => {
      globalThis.fetch = originalFetch;
    };
  });

  afterAll(async () => {
    restoreFetch();
    await pool.end();
  });

  it("previews an invoice through proxied fetch with a blob response", async () => {
    const clientRes = await fetch("/api/clients", {
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
    expect(clientRes.status).toBe(201);
    const client = (await clientRes.json()) as { id: string };

    const projectRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, name: "Ondojo" }),
    });
    expect(projectRes.status).toBe(201);
    const project = (await projectRes.json()) as { id: string };

    const entryRes = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        description: "Billable work",
        startedAt: "2026-06-18T10:00:00.000Z",
        endedAt: "2026-06-18T11:00:00.000Z",
      }),
    });
    expect(entryRes.status).toBe(201);

    const previewRes = await fetch("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id,
        from: "2026-06-01",
        to: "2026-06-30",
      }),
    });

    expect(previewRes.status).toBe(200);
    expect(previewRes.headers.get("content-type")).toContain("application/pdf");
    const blob = await previewRes.blob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
