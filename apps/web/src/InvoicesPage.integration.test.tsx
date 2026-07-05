import "./test/load-env.js";

import { fireEvent, render, screen, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { describeWithAuthenticatedWorkspace } from "./test/describe-with-live-api.js";
import InvoicesPage from "./InvoicesPage.js";

function renderInvoicesPage() {
  return render(
    <MemoryRouter>
      <InvoicesPage />
    </MemoryRouter>,
  );
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

async function waitForClientReady(clientName: string, clientId: string) {
  await waitFor(() => {
    const clientSelect = screen.getByLabelText(/^client$/i);
    expect(
      within(clientSelect).getByRole("option", { name: clientName }),
    ).toBeInTheDocument();
    expect(clientSelect).toHaveValue(clientId);
    expect(screen.getByRole("button", { name: /^preview$/i })).toBeEnabled();
  });
}

describeWithAuthenticatedWorkspace(
  "InvoicesPage with live API",
  (getWorkspace) => {
    beforeEach(async () => {
      URL.createObjectURL = vi.fn(() => "blob:test") as typeof URL.createObjectURL;
      URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;

      const { pool } = getWorkspace();
      await pool.query("DELETE FROM time_entries");
      await pool.query("DELETE FROM invoices");
      await pool.query("DELETE FROM workspace_invoice_numbering");
      await pool.query("DELETE FROM client_invoice_numbering");
      await pool.query("DELETE FROM projects");
      await pool.query("DELETE FROM clients");
    });

    it("previews then issues an invoice without marking entries Invoiced until issue", async () => {
      const { pool } = getWorkspace();
      const bandao = await createClient({
        name: "Bandao",
        legalName: "BANDAO Guidance GmbH",
        addressLine1: "Schloßbergstraße 1",
        addressLine2: "82319 Starnberg",
      });
      const ondojo = await createProject(bandao.id, "Ondojo");

      await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: ondojo.id,
          description: "Billable work",
          startedAt: "2026-06-18T10:00:00.000Z",
          endedAt: "2026-06-18T11:00:00.000Z",
        }),
      });

      renderInvoicesPage();

      await waitForClientReady("Bandao", bandao.id);

      fireEvent.click(screen.getByRole("button", { name: /last month/i }));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
      });

      await waitFor(
        () => {
          expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
          expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
          expect(screen.getByTitle(/invoice preview/i)).toBeInTheDocument();
        },
        { timeout: 10_000 },
      );

      const beforeIssue = await (
        await fetch("/api/time-entries?date=2026-06-18")
      ).json();
      expect(beforeIssue.entries[0].invoiced).toBe(false);

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");
      fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));

      await waitFor(() => {
        expect(clickSpy).toHaveBeenCalled();
      });
      clickSpy.mockRestore();

      const afterIssue = await (
        await fetch("/api/time-entries?date=2026-06-18")
      ).json();
      expect(afterIssue.entries[0].invoiced).toBe(true);

      const invoices = await pool.query("SELECT id FROM invoices");
      expect(invoices.rows).toHaveLength(1);

      await waitFor(() => {
        expect(screen.getByText("BANDAO Guidance GmbH")).toBeInTheDocument();
        expect(screen.getAllByText("BAN2026001").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("06/01/2026 – 06/30/2026")).toBeInTheDocument();
        expect(screen.getByText("€60.00")).toBeInTheDocument();
      });

      const clickSpy2 = vi.spyOn(HTMLAnchorElement.prototype, "click");
      fireEvent.click(
        screen.getByRole("button", { name: /download invoice BAN2026001/i }),
      );

      await waitFor(() => {
        expect(clickSpy2).toHaveBeenCalled();
      });
      clickSpy2.mockRestore();
    });

    it("links to the Clients page when Recipient fields are missing", async () => {
      const hannah = await createClient({ name: "Hannah", defaultRate: 80 });

      renderInvoicesPage();

      await waitForClientReady("Hannah", hannah.id);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
      });

      await waitFor(
        () => {
          expect(screen.getByRole("link", { name: /clients page/i })).toHaveAttribute(
            "href",
            `/clients?edit=${hannah.id}`,
          );
        },
        { timeout: 10_000 },
      );
    });

    it("links to the Tracker when there are no billable entries", async () => {
      const bandao = await createClient({
        name: "Bandao",
        legalName: "BANDAO Guidance GmbH",
        addressLine1: "Schloßbergstraße 1",
        addressLine2: "82319 Starnberg",
      });

      renderInvoicesPage();

      await waitForClientReady("Bandao", bandao.id);
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
      });

      await waitFor(
        () => {
          expect(screen.getByRole("link", { name: /^tracker$/i })).toHaveAttribute(
            "href",
            "/tracker",
          );
        },
        { timeout: 10_000 },
      );
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();
    });
  },
  { timeout: 30_000 },
);
