import "./load-env.js";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import InvoicesPage from "../InvoicesPage.js";
import { describeWithAuthenticatedWorkspace } from "./describe-with-live-api.js";

/** July so “last month” quick control selects June (fixture entry month). */
const JULY_2026 = new Date("2026-07-15T12:00:00.000Z");

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

function renderInvoicesPage() {
  return render(
    <MemoryRouter>
      <InvoicesPage />
    </MemoryRouter>,
  );
}

describeWithAuthenticatedWorkspace(
  "authenticated fetch proxy in jsdom",
  () => {
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

    it("reads preview errors and PDF blobs through proxied fetch", async () => {
      const clientRes = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hannah", defaultRate: 80 }),
      });
      expect(clientRes.status).toBe(201);
      const client = (await clientRes.json()) as { id: string };

      const errorRes = await fetch("/api/invoices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          from: "2026-06-01",
          to: "2026-06-30",
        }),
      });
      expect(errorRes.status).toBe(400);
      const errorBody = (await errorRes.json()) as { error?: string };
      expect(errorBody.error).toMatch(/recipient fields are required/i);

      const recipientRes = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bandao",
          defaultRate: 60,
          legalName: "BANDAO Guidance GmbH",
          addressLine1: "Schloßbergstraße 1",
          addressLine2: "82319 Starnberg",
        }),
      });
      const bandao = (await recipientRes.json()) as { id: string };

      const projectRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: bandao.id, name: "Ondojo" }),
      });
      const project = (await projectRes.json()) as { id: string };

      await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          description: "Billable work",
          startedAt: "2026-06-18T10:00:00.000Z",
          endedAt: "2026-06-18T11:00:00.000Z",
        }),
      });

      const previewRes = await fetch("/api/invoices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: bandao.id,
          from: "2026-06-01",
          to: "2026-06-30",
        }),
      });

      expect(previewRes.status).toBe(200);
      expect(previewRes.headers.get("X-Invoice-Number")).toBe("BAN2026001");
      const blob = await previewRes.blob();
      expect(blob.size).toBeGreaterThan(0);
    });

    it("renders InvoicesPage preview through the proxied fetch", async () => {
      const clientRes = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bandao",
          defaultRate: 60,
          legalName: "BANDAO Guidance GmbH",
          addressLine1: "Schloßbergstraße 1",
          addressLine2: "82319 Starnberg",
        }),
      });
      const bandao = (await clientRes.json()) as { id: string };

      const projectRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: bandao.id, name: "Ondojo" }),
      });
      const project = (await projectRes.json()) as { id: string };

      await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
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
          expect(screen.getByTitle(/invoice preview/i)).toBeInTheDocument();
        },
        { timeout: 10_000 },
      );
    });
  },
  { timeout: 30_000 },
);
