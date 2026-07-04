import "./test/load-env.js";

import { Pool } from "pg";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupAuthenticatedApiFetch } from "./test/authenticated-api.js";
import App from "./App.js";

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
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /today/i })).toBeInTheDocument();
      expect(screen.getByText(/no time logged today yet/i)).toBeInTheDocument();
    });
  });

  it("navigates to the Invoices page", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /^invoices$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^invoices$/i })).toBeInTheDocument();
    });
  });
});
