import "./test/load-env.js";

import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { fireEvent, render, screen, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { describeWithAuthenticatedWorkspace } from "./test/describe-with-live-api.js";
import InvoicesPage from "./InvoicesPage.js";
import { isQuietInvoiceConflictMessage } from "./invoices/invoice-preview-quiet.js";
import { createMatchMediaWithOptions } from "./test/match-media.js";
import { POST_ISSUE_PREPARE_EMAIL_BLINK_MS } from "./invoices/post-issue-email-handoff.js";

/** July so “last month” quick control selects June (fixture entry month). */
const JULY_2026 = new Date("2026-07-15T12:00:00.000Z");

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
  recipientEmail?: string;
}): Promise<{ id: string; name: string }> {
  const { recipientEmail, ...createInput } = input;
  const res = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ defaultRate: 60, ...createInput }),
  });
  const client = (await res.json()) as { id: string; name: string };
  if (recipientEmail) {
    await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientEmail }),
    });
  }
  return client;
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
  });
}

async function waitForAutoPreview() {
  await waitFor(() => {
    expect(screen.getByTitle(/invoice preview/i)).toBeInTheDocument();
  });
}

function previewRegion() {
  return screen.getByRole("region", { name: /invoice preview/i });
}

async function waitForQuietBillingMonthPreview() {
  await waitFor(
    () => {
      expect(screen.queryByTitle(/invoice preview/i)).not.toBeInTheDocument();
      expect(
        within(previewRegion()).getByText(
          (content, element) =>
            element?.tagName === "P" &&
            isQuietInvoiceConflictMessage(content),
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
    { timeout: 10_000 },
  );
}

describeWithAuthenticatedWorkspace(
  "InvoicesPage with live API",
  (getWorkspace) => {
    beforeAll(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(JULY_2026);
    });

    beforeEach(() => {
      vi.setSystemTime(JULY_2026);
      URL.createObjectURL = vi.fn(() => "blob:test") as typeof URL.createObjectURL;
      URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("previews then issues an invoice without marking entries Invoiced until issue", async () => {
      const { pool } = getWorkspace();
      const bandao = await createClient({
        name: "Bandao",
        legalName: "BANDAO Guidance GmbH",
        addressLine1: "Schloßbergstraße 1",
        addressLine2: "82319 Starnberg",
        recipientEmail: "billing@bandao.example",
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

      await waitForAutoPreview();

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
        expect(clickSpy).not.toHaveBeenCalled();
      });
      clickSpy.mockRestore();

      await waitForQuietBillingMonthPreview();

      const afterIssue = await (
        await fetch("/api/time-entries?date=2026-06-18")
      ).json();
      expect(afterIssue.entries[0].invoiced).toBe(true);

      const invoices = await pool.query("SELECT id FROM invoices WHERE workspace_id = $1", [
        DEFAULT_WORKSPACE_ID,
      ]);
      expect(invoices.rows).toHaveLength(1);

      await waitFor(() => {
        expect(screen.getAllByText(/BANDAO Guidance GmbH/).length).toBeGreaterThan(0);
        expect(screen.getAllByText("BAN2026001").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/06\/01\/2026/)).toBeInTheDocument();
        expect(screen.getAllByText(/€60\.00|60[,.]00\s*€/).length).toBeGreaterThan(0);
        expect(screen.getByTestId("issued-invoice-email-panel")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^email$/i })).toHaveClass(
          "border-b-2",
        );
      });

      const clickSpy2 = vi.spyOn(HTMLAnchorElement.prototype, "click");
      fireEvent.click(screen.getByRole("button", { name: /^pdf$/i }));
      fireEvent.click(
        screen.getByRole("button", { name: /download invoice BAN2026001/i }),
      );

      await waitFor(() => {
        expect(clickSpy2).toHaveBeenCalled();
      });
      clickSpy2.mockRestore();
    });

    it("after issue opens Email tab and blinks Prepare Email when recipient email exists", async () => {
      window.matchMedia = createMatchMediaWithOptions({
        wide: true,
        reducedMotion: false,
      }) as typeof window.matchMedia;
      Element.prototype.scrollIntoView = vi.fn();

      const bandao = await createClient({
        name: "Bandao",
        legalName: "BANDAO Guidance GmbH",
        addressLine1: "Schloßbergstraße 1",
        addressLine2: "82319 Starnberg",
        recipientEmail: "billing@bandao.example",
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
      await waitForAutoPreview();

      fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));
      await waitForQuietBillingMonthPreview();

      await waitFor(() => {
        expect(screen.getByTestId("issued-invoice-email-panel")).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /^email$/i })).toHaveClass(
        "border-b-2",
      );
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

      const prepareButton = screen.getByRole("button", { name: /prepare email/i });
      await waitFor(() => {
        expect(prepareButton).toHaveClass("prepare-email-attention");
      });

      await waitFor(
        () => {
          expect(prepareButton).not.toHaveClass("prepare-email-attention");
        },
        { timeout: POST_ISSUE_PREPARE_EMAIL_BLINK_MS + 1000 },
      );
    });

    it("after issue opens Email tab without blinking when recipient email is missing", async () => {
      window.matchMedia = createMatchMediaWithOptions({
        wide: true,
        reducedMotion: false,
      }) as typeof window.matchMedia;
      Element.prototype.scrollIntoView = vi.fn();

      const hannah = await createClient({
        name: "Hannah",
        defaultRate: 80,
        legalName: "Hannah Coaching",
        addressLine1: "Main Street 1",
        addressLine2: "80331 Munich",
      });
      const coaching = await createProject(hannah.id, "Coaching");

      await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: coaching.id,
          description: "Session",
          startedAt: "2026-06-10T10:00:00.000Z",
          endedAt: "2026-06-10T11:00:00.000Z",
        }),
      });

      renderInvoicesPage();
      await waitForClientReady("Hannah", hannah.id);
      fireEvent.click(screen.getByRole("button", { name: /last month/i }));
      await waitForAutoPreview();
      fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));
      await waitForQuietBillingMonthPreview();

      await waitFor(() => {
        expect(screen.getByTestId("issued-invoice-email-panel")).toBeInTheDocument();
      });
      expect(
        screen.getByRole("button", { name: /prepare email/i }),
      ).not.toHaveClass("prepare-email-attention");
    });

    it("links to the Clients page when Recipient fields are missing", async () => {
      const hannah = await createClient({ name: "Hannah", defaultRate: 80 });

      renderInvoicesPage();

      await waitForClientReady("Hannah", hannah.id);

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
