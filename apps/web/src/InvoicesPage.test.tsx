import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function emptyInvoicesListResponse() {
  return Promise.resolve({
    ok: true,
    json: async () => ({ invoices: [] }),
  });
}

function clientsResponse(clients: unknown[]) {
  return Promise.resolve({
    ok: true,
    json: async () => ({ clients }),
  });
}

type FetchHandler = (
  url: string,
  init?: RequestInit,
) => Promise<unknown> | undefined;

function createInvoicesPageFetchMock(clients: unknown[], handler?: FetchHandler) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const custom = handler?.(url, init);
    if (custom !== undefined) return custom;

    if (url === "/api/clients") return clientsResponse(clients);
    if (url === "/api/invoices" && !init?.method) return emptyInvoicesListResponse();
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function clientsFetchMock(clients: unknown[]) {
  return createInvoicesPageFetchMock(clients, (url, init) => {
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
    return undefined;
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
    const clientSelect = screen.getByLabelText(/^client$/i);
    expect(
      within(clientSelect).getByRole("option", { name: clientName }),
    ).toBeInTheDocument();
    expect(clientSelect).toHaveValue(clientId);
  });
}

describe("InvoicesPage", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:test") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  });

  it("loads Clients into a select and defaults the Billing Period to the current month", async () => {
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));

    const expectedRange = currentMonthRange();
    render(<InvoicesPage />);

    await waitFor(() => {
      const clientSelect = screen.getByLabelText(/^client$/i);
      expect(clientSelect).toBeInTheDocument();
      expect(
        within(clientSelect).getByRole("option", { name: "Bandao" }),
      ).toBeInTheDocument();
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
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("2026001"));
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
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<InvoicesPage />);

    await waitForClientReady("Bandao", bandaoClient.id);

    expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    await waitFor(() => {
      expect(screen.getByText("2026001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/no billable time entries in this billing period/i),
      ).toBeInTheDocument();
    });
  });

  it("shows an inline error for a duplicate Billing Period", async () => {
    vi.stubGlobal(
      "fetch",
      createInvoicesPageFetchMock([bandaoClient], (url, init) => {
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
        return undefined;
      }),
    );

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
    vi.stubGlobal(
      "fetch",
      createInvoicesPageFetchMock([bandaoClient], (url, init) => {
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
        return undefined;
      }),
    );

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
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("2026001"));
      }
      return undefined;
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

  it("keeps Issue Invoice disabled until preview succeeds for the current selection", async () => {
    vi.stubGlobal(
      "fetch",
      createInvoicesPageFetchMock([bandaoClient], (url, init) => {
        if (url === "/api/invoices/preview" && init?.method === "POST") {
          return Promise.resolve(previewPdfResponse("2026001"));
        }
        return undefined;
      }),
    );

    render(<InvoicesPage />);

    await waitForClientReady("Bandao", bandaoClient.id);

    expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeEnabled();
    });
  });

  it("issues the invoice and downloads the PDF", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("2026001"));
      }
      if (url === "/api/invoices" && init?.method === "POST") {
        return Promise.resolve(issuePdfResponse("2026001"));
      }
      return undefined;
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

    await waitFor(() => {
      expect(screen.queryByTitle(/invoice preview/i)).not.toBeInTheDocument();
      expect(screen.getByText("2026001")).toBeInTheDocument();
    });

    clickSpy.mockRestore();
  });

  it("lists issued invoices and re-downloads a PDF", async () => {
    const issuedInvoice = {
      id: "inv-00000000-0000-4000-8000-000000000001",
      recipient: "BANDAO Guidance GmbH",
      invoiceNumber: "2026001",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      totalAmount: 60,
    };

    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices" && !init?.method) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ invoices: [issuedInvoice] }),
        });
      }
      if (url === `/api/invoices/${issuedInvoice.id}/pdf`) {
        return Promise.resolve(
          new Response(new Blob(["%PDF-reconstructed"], { type: "application/pdf" }), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition":
                'attachment; filename="2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf"',
            },
          }),
        );
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText("BANDAO Guidance GmbH")).toBeInTheDocument();
      expect(screen.getByText("2026001")).toBeInTheDocument();
      expect(screen.getByText("2026-06-01 – 2026-06-30")).toBeInTheDocument();
      expect(screen.getByText("60.00 EUR")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /download invoice 2026001/i,
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/invoices/${issuedInvoice.id}/pdf`);
      expect(clickSpy).toHaveBeenCalled();
    });

    clickSpy.mockRestore();
  });

  it("exports Outgoing.zip with optional client and year filters", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url) => {
      if (url.startsWith("/api/invoices/export.zip")) {
        return Promise.resolve(
          new Response(new Blob(["PK"], { type: "application/zip" }), {
            status: 200,
            headers: {
              "Content-Type": "application/zip",
              "Content-Disposition": 'attachment; filename="Outgoing.zip"',
            },
          }),
        );
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/export client/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/export client/i), {
      target: { value: bandaoClient.id },
    });
    fireEvent.change(screen.getByLabelText(/export year/i), {
      target: { value: "2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: /export outgoing\.zip/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/invoices/export.zip?client=${bandaoClient.id}&year=2026`,
      );
      expect(clickSpy).toHaveBeenCalled();
    });

    clickSpy.mockRestore();
  });
});
