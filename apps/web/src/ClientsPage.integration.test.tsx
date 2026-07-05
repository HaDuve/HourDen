import "./test/load-env.js";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { describeWithAuthenticatedWorkspace } from "./test/describe-with-live-api.js";
import ClientsPage from "./ClientsPage.js";

function renderClientsPage() {
  return render(
    <MemoryRouter>
      <ClientsPage />
    </MemoryRouter>,
  );
}

describeWithAuthenticatedWorkspace("ClientsPage with live API", (getWorkspace) => {
  beforeEach(async () => {
    const { pool } = getWorkspace();
    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
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
