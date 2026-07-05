import "./test/load-env.js";

import { Pool } from "pg";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { setupAuthenticatedApiFetch } from "./test/authenticated-api.js";
import { resetMockEventSources } from "./test/mock-event-source.js";
import { authenticatedAppRoutes } from "./routes.js";

function renderApp() {
  const router = createMemoryRouter(authenticatedAppRoutes, { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
  return router;
}

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("App with live API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let restoreFetch: () => void;

  beforeAll(async () => {
    ({ restoreFetch } = await setupAuthenticatedApiFetch(pool));
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
  });

  afterEach(async () => {
    cleanup();
    resetMockEventSources();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  afterAll(async () => {
    restoreFetch();
    await pool.end();
  });

  it("loads the Tracker page from the live API", async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
      expect(screen.getByText(/no time entries yet/i)).toBeInTheDocument();
    });
  });

  it("loads the Invoices page from a deep link", async () => {
    const router = createMemoryRouter(authenticatedAppRoutes, {
      initialEntries: ["/invoices"],
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^invoices$/i })).toBeInTheDocument();
    });
  });
});
