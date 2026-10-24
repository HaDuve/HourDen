import "./test/load-env.js";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { authenticatedAppRoutes } from "./routes.js";
import { describeWithAuthenticatedWorkspace } from "./test/describe-with-live-api.js";
import { createMatchMediaWithOptions } from "./test/match-media.js";

function renderApp(path: string) {
  const router = createMemoryRouter(authenticatedAppRoutes, {
    initialEntries: [path],
  });
  return render(<RouterProvider router={router} />);
}

async function createClient(input: {
  name: string;
  defaultRate?: number;
  legalName?: string;
  addressLine1?: string;
  addressLine2?: string;
}): Promise<{ id: string; name: string }> {
  const res = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ defaultRate: 60, ...input }),
  });
  return res.json() as Promise<{ id: string; name: string }>;
}

async function createProject(
  clientId: string,
  name: string,
): Promise<{ id: string }> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, name }),
  });
  return res.json() as Promise<{ id: string }>;
}

describeWithAuthenticatedWorkspace(
  "Close the Month with live API",
  () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        createMatchMediaWithOptions({ matches: true }),
      );
      URL.createObjectURL = vi.fn(() => "blob:test") as typeof URL.createObjectURL;
      URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
    });

    it("covers incomplete entry → fix description → preview invoice", async () => {
      const bandao = await createClient({
        name: "Bandao",
        legalName: "BANDAO Guidance GmbH",
        addressLine1: "Schloßbergstraße 1",
        addressLine2: "82319 Starnberg",
      });
      const ondojo = await createProject(bandao.id, "Ondojo");

      const completeRes = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: ondojo.id,
          description: "App Development",
          startedAt: "2026-10-05T10:00:00.000Z",
          endedAt: "2026-10-05T11:00:00.000Z",
        }),
      });
      expect(completeRes.status).toBe(201);

      const incompleteRes = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: ondojo.id,
          description: "",
          startedAt: "2026-10-06T10:00:00.000Z",
          endedAt: "2026-10-06T11:00:00.000Z",
        }),
      });
      expect(incompleteRes.status).toBe(201);

      renderApp("/close-the-month?from=2026-10-01&to=2026-10-31");

      expect(
        await screen.findByRole("heading", { name: /close the month/i }),
      ).toBeInTheDocument();
      expect(await screen.findByText("Bandao")).toBeInTheDocument();
      expect(screen.getByText(/1 of 2 Billable Complete/i)).toBeInTheDocument();

      const input = screen.getByLabelText(/description for incomplete entry/i);
      fireEvent.change(input, { target: { value: "Follow-up" } });
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.getByText(/2 of 2 Billable Complete/i)).toBeInTheDocument();
      });

      const previewLink = screen.getByRole("link", { name: /preview invoice/i });
      expect(previewLink).toHaveAttribute(
        "href",
        `/invoices?clientId=${bandao.id}&from=2026-10-01&to=2026-10-31`,
      );
      fireEvent.click(previewLink);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /^invoices$/i }),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        const clientSelect = screen.getByLabelText(/^client$/i);
        expect(clientSelect).toHaveValue(bandao.id);
      });
      expect(screen.getByLabelText(/^from$/i)).toHaveValue("2026-10-01");
      expect(screen.getByLabelText(/^to$/i)).toHaveValue("2026-10-31");

      await waitFor(
        () => {
          expect(
            within(screen.getByRole("region", { name: /invoice preview/i })).getByTitle(
              /invoice preview/i,
            ),
          ).toBeInTheDocument();
        },
        { timeout: 10_000 },
      );
    });
  },
  { timeout: 60_000 },
);
