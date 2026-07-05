import "./test/load-env.js";

import { Pool } from "pg";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupAuthenticatedApiFetch } from "./test/authenticated-api.js";
import ClientsPage from "./ClientsPage.js";

const databaseUrl = process.env.DATABASE_URL;

function renderClientsPage() {
  return render(
    <MemoryRouter>
      <ClientsPage />
    </MemoryRouter>,
  );
}

describe.skipIf(!databaseUrl)("ClientsPage with live API", () => {
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

  it("creates and lists a Client end-to-end", async () => {
    renderClientsPage();

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
      expect(screen.getByText("€60.00/h")).toBeInTheDocument();
    });
  });
});
