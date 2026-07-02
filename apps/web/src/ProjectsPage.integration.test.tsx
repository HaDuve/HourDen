import "./test/load-env.js";

import { Pool } from "pg";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../api/src/app.js";
import { runMigrations } from "../../api/src/db/migrate.js";
import ProjectsPage from "./ProjectsPage.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("ProjectsPage with live API", () => {
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

  it("creates and lists a Project under a Client end-to-end", async () => {
    const clientRes = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bandao", defaultRate: 60 }),
    });
    const client = (await clientRes.json()) as { id: string; name: string };

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^client$/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Bandao" })).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    select.value = client.id;
    fireEvent.change(select);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new project/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /new project/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Ondojo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Ondojo")).toBeInTheDocument();
    });
  });
});
