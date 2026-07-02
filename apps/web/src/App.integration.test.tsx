import "./test/load-env.js";

import { Pool } from "pg";
import { render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../api/src/app.js";
import { runMigrations } from "../../api/src/db/migrate.js";
import App from "./App.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("App with live API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let originalFetch: typeof fetch;

  beforeAll(async () => {
    originalFetch = globalThis.fetch;
    await runMigrations(pool);

    const app = createApp({ pool });
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
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await pool.end();
  });

  it("loads the Clients page from the live API", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /clients/i })).toBeInTheDocument();
      expect(screen.getByText(/no clients yet/i)).toBeInTheDocument();
    });
  });
});
