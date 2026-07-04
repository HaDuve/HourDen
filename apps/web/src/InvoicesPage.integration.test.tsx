import "./test/load-env.js";

import { Pool } from "pg";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupAuthenticatedApiFetch } from "./test/authenticated-api.js";
import InvoicesPage from "./InvoicesPage.js";

const databaseUrl = process.env.DATABASE_URL;

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

describe.skipIf(!databaseUrl)("InvoicesPage with live API", { timeout: 30_000 }, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let restoreFetch: () => void;

  beforeAll(async () => {
    ({ restoreFetch } = await setupAuthenticatedApiFetch(pool));
  });

  beforeEach(async () => {
    URL.createObjectURL = vi.fn(() => "blob:test") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;

    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM invoices");
    await pool.query("DELETE FROM workspace_invoice_numbering");
    await pool.query("DELETE FROM client_invoice_numbering");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
  });

  afterAll(async () => {
    restoreFetch();
    await pool.end();
  });

  it("previews then issues an invoice without marking entries Invoiced until issue", async () => {
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

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(
        within(screen.getByLabelText(/^client$/i)).getByRole("option", {
          name: "Bandao",
        }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^client$/i), {
      target: { value: bandao.id },
    });
    fireEvent.change(screen.getByLabelText(/^from$/i), {
      target: { value: "2026-06-01" },
    });
    fireEvent.change(screen.getByLabelText(/^to$/i), {
      target: { value: "2026-06-30" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
      expect(screen.getByTitle(/invoice preview/i)).toBeInTheDocument();
    });

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
      expect(screen.getByText("2026-06-01 – 2026-06-30")).toBeInTheDocument();
      expect(screen.getByText("60.00 EUR")).toBeInTheDocument();
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

  it("shows an inline error when Recipient fields are missing", async () => {
    const hannah = await createClient({ name: "Hannah", defaultRate: 80 });

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(
        within(screen.getByLabelText(/^client$/i)).getByRole("option", {
          name: "Hannah",
        }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^client$/i), {
      target: { value: hannah.id },
    });
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/client recipient fields are required before invoicing/i),
      ).toBeInTheDocument();
    });
  });

  it("shows an inline error when there are no billable entries", async () => {
    const bandao = await createClient({
      name: "Bandao",
      legalName: "BANDAO Guidance GmbH",
      addressLine1: "Schloßbergstraße 1",
      addressLine2: "82319 Starnberg",
    });

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(
        within(screen.getByLabelText(/^client$/i)).getByRole("option", {
          name: "Bandao",
        }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^client$/i), {
      target: { value: bandao.id },
    });
    expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/no billable time entries in this billing period/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();
  });
});
