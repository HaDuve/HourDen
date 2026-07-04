import "./test/load-env.js";

import { Pool } from "pg";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { setupAuthenticatedApiFetch } from "./test/authenticated-api.js";
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

  afterAll(async () => {
    restoreFetch();
    await pool.end();
  });

  it("loads the Today page from the live API", async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /today/i })).toBeInTheDocument();
      expect(screen.getByText(/no time logged today yet/i)).toBeInTheDocument();
    });
  });

  it("navigates to the Invoices page", async () => {
    renderApp();

    fireEvent.click(screen.getByRole("link", { name: /^invoices$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^invoices$/i })).toBeInTheDocument();
    });
  });
});
