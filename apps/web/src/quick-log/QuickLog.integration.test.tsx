import "../test/load-env.js";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describeWithAuthenticatedWorkspace } from "../test/describe-with-live-api.js";
import { authenticatedAppRoutes } from "../routes.js";

describeWithAuthenticatedWorkspace("Quick Log with live API", () => {
  it("creates a manual entry and starts/stops the Running Timer", async () => {
    const router = createMemoryRouter(authenticatedAppRoutes, {
      initialEntries: ["/dashboard"],
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    });

    const clientRes = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "QuickLog Client", defaultRate: 90 }),
    });
    expect(clientRes.status).toBe(201);
    const client = (await clientRes.json()) as { id: string };

    const projectRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, name: "QuickLog Project" }),
    });
    expect(projectRes.status).toBe(201);

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = await screen.findByLabelText(/quick log command/i);
    fireEvent.change(input, {
      target: { value: "1h quicklog project integration manual" },
    });

    await waitFor(() => {
      expect(screen.getByText(/quicklog project → quicklog client/i)).toBeInTheDocument();
      expect(screen.getByText(/press enter to confirm/i)).toBeInTheDocument();
    });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /quick log/i })).not.toBeInTheDocument();
    });

    const listRes = await fetch("/api/time-entries?limit=50");
    const { entries } = (await listRes.json()) as {
      entries: Array<{ description: string | null }>;
    };
    expect(
      entries.some((entry) => entry.description === "integration manual"),
    ).toBe(true);

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    const startInput = await screen.findByLabelText(/quick log command/i);
    fireEvent.change(startInput, {
      target: { value: "start quicklog project integration timer" },
    });
    fireEvent.submit(startInput.closest("form")!);

    await waitFor(async () => {
      const runningRes = await fetch("/api/time-entries/running");
      const { entry } = (await runningRes.json()) as {
        entry: { id: string; description: string | null } | null;
      };
      expect(entry).not.toBeNull();
      expect(entry?.description).toBe("integration timer");
    });

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    const stopInput = await screen.findByLabelText(/quick log command/i);
    fireEvent.change(stopInput, { target: { value: "stop" } });
    fireEvent.submit(stopInput.closest("form")!);

    await waitFor(async () => {
      const runningRes = await fetch("/api/time-entries/running");
      const { entry } = (await runningRes.json()) as { entry: unknown | null };
      expect(entry).toBeNull();
    });
  });
});
