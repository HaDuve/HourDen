import "./test/load-env.js";

import { Pool } from "pg";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../api/src/app.js";
import { runMigrations } from "../../api/src/db/migrate.js";
import ClientsPage from "./ClientsPage.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("ClientsPage with live API", () => {
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
    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await pool.end();
  });

  it("creates and lists a Client end-to-end", async () => {
    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no clients yet/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /new client/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Bandao" },
    });
    fireEvent.change(screen.getByLabelText(/default rate/i), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Bandao")).toBeInTheDocument();
      expect(screen.getByText("60 €/h")).toBeInTheDocument();
    });
  });
});
