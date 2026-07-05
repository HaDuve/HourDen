import "./test/load-env.js";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { describeWithAuthenticatedWorkspace } from "./test/describe-with-live-api.js";
import ProjectsPage from "./ProjectsPage.js";

describeWithAuthenticatedWorkspace("ProjectsPage with live API", (getWorkspace) => {
  beforeEach(async () => {
    const { pool } = getWorkspace();
    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
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
