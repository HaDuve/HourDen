import "./test/load-env.js";

import { Pool } from "pg";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { setupAuthenticatedApiFetch } from "./test/authenticated-api.js";
import AppLayout from "./App.js";
import ClientsPage from "./ClientsPage.js";
import ImportPage from "./ImportPage.js";
import InvoicesPage from "./InvoicesPage.js";
import ProjectsPage from "./ProjectsPage.js";
import ReportPage from "./ReportPage.js";
import TodayPage from "./TodayPage.js";

function renderApp() {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <TodayPage /> },
          { path: "today", element: <TodayPage /> },
          { path: "clients", element: <ClientsPage /> },
          { path: "projects", element: <ProjectsPage /> },
          { path: "report", element: <ReportPage /> },
          { path: "invoices", element: <InvoicesPage /> },
          { path: "import", element: <ImportPage /> },
        ],
      },
    ],
    { initialEntries: ["/"] },
  );
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
