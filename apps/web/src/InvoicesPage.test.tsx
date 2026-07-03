import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import InvoicesPage from "./InvoicesPage.js";

const bandaoClient = {
  id: "c0000000-0000-4000-8000-000000000001",
  name: "Bandao",
  defaultRate: 60,
  legalName: "BANDAO Guidance GmbH",
  addressLine1: "Schloßbergstraße 1",
  addressLine2: "82319 Starnberg",
};

const clientWithoutRecipient = {
  id: "c0000000-0000-4000-8000-000000000002",
  name: "Hannah",
  defaultRate: 80,
  legalName: null,
  addressLine1: null,
  addressLine2: null,
};

function clientsFetchMock(clients: unknown[]) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/clients") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ clients }),
      });
    }
    if (url === "/api/invoices/preview" && init?.method === "POST") {
      return Promise.resolve({
        ok: false,
        status: 400,
        json: async () => ({
          error: "Client Recipient fields are required before invoicing",
        }),
      });
    }
    if (url === "/api/invoices" && init?.method === "POST") {
      return Promise.resolve({
        ok: false,
        status: 400,
        json: async () => ({
          error: "No billable Time Entries in this Billing Period",
        }),
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function previewPdfResponse(invoiceNumber: string) {
  return new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "X-Invoice-Number": invoiceNumber,
    },
  });
}

function issuePdfResponse(invoiceNumber: string) {
  return new Response(new Blob(["%PDF-issued"], { type: "application/pdf" }), {
    status: 201,
    headers: {
      "Content-Type": "application/pdf",
      "X-Invoice-Number": invoiceNumber,
      "Content-Disposition":
        'attachment; filename="2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf"',
    },
  });
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`;
  return { from, to };
}

async function waitForClientReady(clientName: string, clientId: string) {
  await waitFor(() => {
    expect(screen.getByRole("option", { name: clientName })).toBeInTheDocument();
    expect(screen.getByLabelText(/^client$/i)).toHaveValue(clientId);
  });
}

describe("InvoicesPage", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:test") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  });

  it("loads Clients into a select and defaults the Billing Period to the current month", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clients: [bandaoClient] }),
      }),
    );

    const expectedRange = currentMonthRange();
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^client$/i)).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Bandao" })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/^from$/i)).toHaveValue(expectedRange.from);
    expect(screen.getByLabelText(/^to$/i)).toHaveValue(expectedRange.to);
  });

  it("shows an inline error when preview fails because Recipient fields are missing", async () => {
    vi.stubGlobal("fetch", clientsFetchMock([clientWithoutRecipient]));

    render(<InvoicesPage />);

    await waitForClientReady("Hannah", clientWithoutRecipient.id);

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/client recipient fields are required before invoicing/i),
      ).toBeInTheDocument();
    });
  });

  it("shows an inline error when issue fails because there are no billable entries", async () => {
    vi.stubGlobal("fetch", clientsFetchMock([bandaoClient]));

    render(<InvoicesPage />);

    await waitForClientReady("Bandao", bandaoClient.id);

    fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/no billable time entries in this billing period/i),
      ).toBeInTheDocument();
    });
  });

  it("shows an inline error for a duplicate Billing Period", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/clients") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ clients: [bandaoClient] }),
        });
      }
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("2026001"));
      }
      if (url === "/api/invoices" && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: "Invoice already exists for this Client and Billing Period",
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<InvoicesPage />);

    await waitForClientReady("Bandao", bandaoClient.id);

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    await waitFor(() => {
      expect(screen.getByText("2026001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invoice already exists for this client and billing period/i),
      ).toBeInTheDocument();
    });
  });

  it("shows an inline error for a duplicate billing month", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/clients") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ clients: [bandaoClient] }),
        });
      }
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("2026001"));
      }
      if (url === "/api/invoices" && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: "Invoice already exists for this Client and billing month",
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<InvoicesPage />);

    await waitForClientReady("Bandao", bandaoClient.id);

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    await waitFor(() => {
      expect(screen.getByText("2026001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invoice already exists for this client and billing month/i),
      ).toBeInTheDocument();
    });
  });

  it("previews the invoice PDF and shows the next Invoice Number without issuing", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/clients") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ clients: [bandaoClient] }),
        });
      }
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("2026001"));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<InvoicesPage />);

    await waitForClientReady("Bandao", bandaoClient.id);

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByText("2026001")).toBeInTheDocument();
      expect(screen.getByTitle(/invoice preview/i)).toHaveAttribute("src", "blob:test");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/invoices/preview",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          clientId: bandaoClient.id,
          from: currentMonthRange().from,
          to: currentMonthRange().to,
        }),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/invoices",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("issues the invoice and downloads the PDF", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/clients") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ clients: [bandaoClient] }),
        });
      }
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("2026001"));
      }
      if (url === "/api/invoices" && init?.method === "POST") {
        return Promise.resolve(issuePdfResponse("2026001"));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    render(<InvoicesPage />);

    await waitForClientReady("Bandao", bandaoClient.id);

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    await waitFor(() => {
      expect(screen.getByText("2026001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/invoices",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            clientId: bandaoClient.id,
            from: currentMonthRange().from,
            to: currentMonthRange().to,
          }),
        }),
      );
      expect(clickSpy).toHaveBeenCalled();
    });

    clickSpy.mockRestore();
  });
});
