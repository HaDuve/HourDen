import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "./i18n/i18n.js";
import InvoicesPage from "./InvoicesPage.js";

function renderInvoicesPage() {
  return render(
    <MemoryRouter>
      <InvoicesPage />
    </MemoryRouter>,
  );
}

const bandaoClient = {
  id: "c0000000-0000-4000-8000-000000000001",
  name: "Bandao",
  defaultRate: 60,
  legalName: "BANDAO Guidance GmbH",
  addressLine1: "Schloßbergstraße 1",
  addressLine2: "82319 Starnberg",
  invoicePrefix: null,
};

const clientWithoutRecipient = {
  id: "c0000000-0000-4000-8000-000000000002",
  name: "Hannah",
  defaultRate: 80,
  legalName: null,
  addressLine1: null,
  addressLine2: null,
  invoicePrefix: null,
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

const defaultInvoiceSender = {
  name: "Hannes Duve",
  street: "Am Deichfleet 116",
  city: "28357 Bremen",
  taxNumber: "06044/47008",
  email: "hannes.duve@outlook.com",
  phone: "+49 15734521445",
  bankName: "Deutsche Kreditbank",
  iban: "DE74 120300001060924758",
  bic: "BYLADEM1001",
};

function invoiceSenderResponse(
  sender = defaultInvoiceSender,
  configured = true,
) {
  return Promise.resolve({
    ok: true,
    json: async () => ({ invoiceSender: sender, configured }),
  });
}

function createInvoicesPageFetchMock(clients: unknown[], handler?: FetchHandler) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const custom = handler?.(url, init);
    if (custom !== undefined) return custom;

    if (url === "/api/clients") return clientsResponse(clients);
    if (url === "/api/invoices" && !init?.method) return emptyInvoicesListResponse();
    if (url === "/api/workspace/invoice-sender" && init?.method === "PATCH") {
      return invoiceSenderResponse();
    }
    if (url === "/api/workspace/invoice-sender") return invoiceSenderResponse();
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
          code: "MISSING_RECIPIENT",
        }),
      });
    }
    if (url === "/api/invoices" && init?.method === "POST") {
      return Promise.resolve({
        ok: false,
        status: 400,
        json: async () => ({
          error: "No billable Time Entries in this Billing Period",
          code: "NO_BILLABLE_ENTRIES",
        }),
      });
    }
    return undefined;
  });
}

function previewPdfResponse(invoiceNumber: string, invoicePrefix = "BAN") {
  return new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "X-Invoice-Number": invoiceNumber,
      "X-Suggested-Invoice-Number": invoiceNumber,
      "X-Suggested-Invoice-Prefix": invoicePrefix,
      "X-Invoice-Number-Exists": "false",
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
        'attachment; filename="BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf"',
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
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    URL.createObjectURL = vi.fn(() => "blob:test") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("labels the billing period and shows a clear issued-invoices empty state", async () => {
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));

    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText("Billing Period")).toBeInTheDocument();
      expect(screen.getByText("No issued invoices yet.")).toBeInTheDocument();
    });
  });

  it("shows German billing-period and empty-state copy when the active locale is de", async () => {
    await i18n.changeLanguage("de");
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));

    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText("Abrechnungszeitraum")).toBeInTheDocument();
      expect(screen.getByText("Noch keine Rechnungen ausgestellt.")).toBeInTheDocument();
    });
  });

  it("shows a catalog error message when loading clients fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/clients") {
          return Promise.reject("offline");
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }),
    );

    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText("Failed to load clients")).toBeInTheDocument();
    });
  });

  it("shows a German catalog error message when loading clients fails", async () => {
    await i18n.changeLanguage("de");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/clients") {
          return Promise.reject("offline");
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }),
    );

    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText("Kunden konnten nicht geladen werden")).toBeInTheDocument();
    });
  });

  it("shows German invoice sender field labels when the active locale is de", async () => {
    await i18n.changeLanguage("de");
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));

    renderInvoicesPage();

    await waitFor(() => {
      const clientSelect = screen.getByLabelText(/^kunde$/i);
      expect(
        within(clientSelect).getByRole("option", { name: "Bandao" }),
      ).toBeInTheDocument();
      expect(clientSelect).toHaveValue(bandaoClient.id);
    });
    fireEvent.click(screen.getByRole("button", { name: /^rechnungsabsender$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^straße$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^steuernummer$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^bankname$/i)).toBeInTheDocument();
    });
  });

  it("sets the Billing Period to last month when the last month quick control is clicked", async () => {
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));
    vi.setSystemTime(new Date(2026, 5, 18));

    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/^client$/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^last month$/i }));

    expect(screen.getByLabelText(/^from$/i)).toHaveValue("2026-05-01");
    expect(screen.getByLabelText(/^to$/i)).toHaveValue("2026-05-31");
  });

  it("loads Clients into a select and defaults the Billing Period to the current month", async () => {
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));

    const expectedRange = currentMonthRange();
    renderInvoicesPage();

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

  it("re-previews with plain numbering when Use prefix is turned off", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as { usePrefix?: boolean };
        const usePrefix = body.usePrefix !== false;
        return Promise.resolve(
          previewPdfResponse(
            usePrefix ? "BAN2026001" : "2026001",
            "BAN",
          ),
        );
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
      expect(screen.getByLabelText(/^use prefix$/i)).toBeChecked();
    });

    fireEvent.click(screen.getByLabelText(/^use prefix$/i));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("2026001");
    });

    const previewCalls = fetchMock.mock.calls.filter(
      ([url, init]) => url === "/api/invoices/preview" && init?.method === "POST",
    );
    expect(previewCalls).toHaveLength(2);
    expect(JSON.parse(previewCalls[1]![1]!.body as string)).toMatchObject({
      usePrefix: false,
    });
  });

  it("shows plain text when preview fails with an unknown blocker code", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: "Something went wrong",
            code: "NOT_A_REAL_BLOCKER",
          }),
        });
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();
    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links to the Clients page when preview fails because Recipient fields are missing", async () => {
    vi.stubGlobal("fetch", clientsFetchMock([clientWithoutRecipient]));

    renderInvoicesPage();

    await waitForClientReady("Hannah", clientWithoutRecipient.id);

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /clients page/i })).toHaveAttribute(
        "href",
        `/clients?edit=${clientWithoutRecipient.id}`,
      );
    });
  });

  it("links to the Tracker when preview succeeds but issue fails because there are no billable entries", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      if (url === "/api/invoices" && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: "No billable Time Entries in this Billing Period",
            code: "NO_BILLABLE_ENTRIES",
          }),
        });
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);

    expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
    });

    fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /^tracker$/i })).toHaveAttribute(
        "href",
        "/tracker",
      );
    });
  });

  it("links to the Projects page when preview fails because time is not assigned to a Project", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: "Time Entries in this Billing Period are not assigned to a Project",
            code: "ENTRIES_WITHOUT_PROJECT",
          }),
        });
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();
    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /projects page/i })).toHaveAttribute(
        "href",
        "/projects",
      );
    });
  });

  it("links to the Tracker when preview fails because stopped entries need a Description", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: "Time Entries in this Billing Period need a Description before invoicing",
            code: "ENTRIES_MISSING_DESCRIPTION",
          }),
        });
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();
    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /^tracker$/i })).toHaveAttribute(
        "href",
        "/tracker",
      );
    });
  });

  it("shows a proactive Clients link when there are no Clients", async () => {
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([]));

    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /clients page/i })).toHaveAttribute(
        "href",
        "/clients?new=1",
      );
    });
  });

  it("shows an inline error for a duplicate Billing Period", async () => {
    vi.stubGlobal(
      "fetch",
      createInvoicesPageFetchMock([bandaoClient], (url, init) => {
        if (url === "/api/invoices/preview" && init?.method === "POST") {
          return Promise.resolve(previewPdfResponse("BAN2026001"));
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

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
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
          return Promise.resolve(previewPdfResponse("BAN2026001"));
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

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
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
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
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
          return Promise.resolve(previewPdfResponse("BAN2026001"));
        }
        return undefined;
      }),
    );

    renderInvoicesPage();

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
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      if (url === "/api/invoices" && init?.method === "POST") {
        return Promise.resolve(issuePdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
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
            invoiceNumber: "BAN2026001",
            invoicePrefix: "BAN",
          }),
        }),
      );
      expect(clickSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByTitle(/invoice preview/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    clickSpy.mockRestore();
  });

  it("lists issued invoices and re-downloads a PDF", async () => {
    const issuedInvoice = {
      id: "inv-00000000-0000-4000-8000-000000000001",
      recipient: "BANDAO Guidance GmbH",
      invoiceNumber: "BAN2026001",
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
                'attachment; filename="BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf"',
            },
          }),
        );
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText("BANDAO Guidance GmbH")).toBeInTheDocument();
      expect(screen.getByText("BAN2026001")).toBeInTheDocument();
      expect(screen.getByText("06/01/2026 – 06/30/2026")).toBeInTheDocument();
      expect(screen.getByText("€60.00")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /download invoice BAN2026001/i,
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

    renderInvoicesPage();

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

  it("does not re-preview while the edited Invoice Number is still incomplete", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as { invoiceNumber?: string };
        const number = body.invoiceNumber ?? "BAN2026001";
        return Promise.resolve(
          new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "X-Invoice-Number": number,
              "X-Suggested-Invoice-Number": "BAN2026001",
              "X-Invoice-Number-Exists": "false",
            },
          }),
        );
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    const previewCallsBeforeEdit = fetchMock.mock.calls.filter(
      ([url, init]) => url === "/api/invoices/preview" && init?.method === "POST",
    ).length;

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "202601" },
    });

    await new Promise((resolve) => setTimeout(resolve, 350));

    const previewCallsAfterPartialEdit = fetchMock.mock.calls.filter(
      ([url, init]) => url === "/api/invoices/preview" && init?.method === "POST",
    ).length;

    expect(previewCallsAfterPartialEdit).toBe(previewCallsBeforeEdit);
    expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("202601");
    expect(screen.queryByText(/invoice number must start with/i)).not.toBeInTheDocument();
  });

  it("allows editing the Invoice Number and re-previews the PDF", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as { invoiceNumber?: string };
        const number = body.invoiceNumber ?? "BAN2026001";
        return Promise.resolve(
          new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "X-Invoice-Number": number,
              "X-Suggested-Invoice-Number": "BAN2026001",
              "X-Invoice-Number-Exists": "false",
            },
          }),
        );
      }
      if (url.startsWith("/api/invoices/numbering-preview")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            exists: false,
            suggestedNumber: "BAN2026001",
            nextIfIssued: { sequential: "BAN2026002", fromLast: "BAN2026001" },
          }),
        });
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "2026010" },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/invoices/preview",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            clientId: bandaoClient.id,
            from: currentMonthRange().from,
            to: currentMonthRange().to,
            invoiceNumber: "2026010",
            invoicePrefix: "BAN",
          }),
        }),
      );
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("2026010");
    });
  });

  it("re-previews the PDF after editing to a hyphen-separated Invoice Number", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as { invoiceNumber?: string };
        const number = body.invoiceNumber ?? "BAN2026001";
        return Promise.resolve(
          new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "X-Invoice-Number": number,
              "X-Suggested-Invoice-Number": "BAN2026001",
              "X-Invoice-Number-Exists": "false",
            },
          }),
        );
      }
      if (url.startsWith("/api/invoices/numbering-preview")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            exists: false,
            suggestedNumber: "BAN2026001",
            nextIfIssued: { sequential: "BAN2026002", fromLast: "BAN2026011" },
          }),
        });
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "BAN-2026-010" },
    });

    await waitFor(
      () => {
        const previewCalls = fetchMock.mock.calls.filter(
          ([callUrl, callInit]) =>
            callUrl === "/api/invoices/preview" && callInit?.method === "POST",
        );
        const lastCall = previewCalls.at(-1);
        expect(lastCall).toBeDefined();
        const body = JSON.parse(lastCall![1]!.body as string) as {
          invoiceNumber?: string;
        };
        expect(body.invoiceNumber).toBe("BAN-2026-010");
      },
      { timeout: 2000 },
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN-2026-010");
    });
  });

  it("shows a warning when the edited Invoice Number already exists", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(
          new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "X-Invoice-Number": "2026010",
              "X-Suggested-Invoice-Number": "BAN2026001",
              "X-Invoice-Number-Exists": "true",
            },
          }),
        );
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invoice number already exists in this workspace/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();
    });
  });

  it("asks how future invoices should be numbered when the Invoice Number is edited", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as { invoiceNumber?: string };
        const number = body.invoiceNumber ?? "BAN2026001";
        return Promise.resolve(
          new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "X-Invoice-Number": number,
              "X-Suggested-Invoice-Number": "BAN2026001",
              "X-Invoice-Number-Exists": "false",
            },
          }),
        );
      }
      if (url.startsWith("/api/invoices/numbering-preview")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            exists: false,
            suggestedNumber: "BAN2026001",
            nextIfIssued: { sequential: "BAN2026002", fromLast: "BAN2026001" },
          }),
        });
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "2026010" },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/continue suggested sequence/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/next: BAN2026002/i)).toBeInTheDocument();
      expect(screen.getByText(/continue from this number/i)).toBeInTheDocument();
      expect(screen.getByText(/next: BAN2026001/i)).toBeInTheDocument();
    });
  });

  it("hides override-strategy radios when the Invoice Number is restored to the suggestion", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as { invoiceNumber?: string };
        const number = body.invoiceNumber ?? "BAN2026001";
        return Promise.resolve(
          new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "X-Invoice-Number": number,
              "X-Suggested-Invoice-Number": "BAN2026001",
              "X-Invoice-Number-Exists": "false",
            },
          }),
        );
      }
      if (url.startsWith("/api/invoices/numbering-preview")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            exists: false,
            suggestedNumber: "BAN2026001",
            nextIfIssued: { sequential: "BAN2026002", fromLast: "BAN2026001" },
          }),
        });
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "2026010" },
    });

    await waitFor(() => {
      expect(screen.getByText(/continue suggested sequence/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/continue from this number/i));

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "BAN2026001" },
    });

    await waitFor(() => {
      expect(screen.queryByText(/continue suggested sequence/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/continue from this number/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).not.toBeDisabled();
    });
  });

  it("issues with the edited Invoice Number and numbering strategy", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as { invoiceNumber?: string };
        const number = body.invoiceNumber ?? "BAN2026001";
        return Promise.resolve(
          new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "X-Invoice-Number": number,
              "X-Suggested-Invoice-Number": "BAN2026001",
              "X-Invoice-Number-Exists": "false",
            },
          }),
        );
      }
      if (url.startsWith("/api/invoices/numbering-preview")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            exists: false,
            suggestedNumber: "BAN2026001",
            nextIfIssued: { sequential: "BAN2026002", fromLast: "BAN2026001" },
          }),
        });
      }
      if (url === "/api/invoices" && init?.method === "POST") {
        return Promise.resolve(issuePdfResponse("2026010"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "2026010" },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/continue from this number/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/continue from this number/i));
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
            invoiceNumber: "2026010",
            invoicePrefix: "BAN",
            numberingStrategy: "from_last",
          }),
        }),
      );
    });

    clickSpy.mockRestore();
  });

  it("calls numbering-preview with usePrefix=false when editing a plain Invoice Number", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as {
          invoiceNumber?: string;
          usePrefix?: boolean;
        };
        const usePrefix = body.usePrefix !== false;
        const number = body.invoiceNumber ?? (usePrefix ? "BAN2026001" : "2026001");
        return Promise.resolve(
          new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "X-Invoice-Number": number,
              "X-Suggested-Invoice-Number": usePrefix ? "BAN2026001" : "2026001",
              "X-Invoice-Number-Exists": "false",
            },
          }),
        );
      }
      if (url.startsWith("/api/invoices/numbering-preview")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            exists: false,
            suggestedNumber: "2026001",
            nextIfIssued: { sequential: "2026002", fromLast: "2026011" },
          }),
        });
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    fireEvent.click(screen.getByLabelText(/^use prefix$/i));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("2026001");
    });

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "2026010" },
    });

    await waitFor(() => {
      const numberingPreviewCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/api/invoices/numbering-preview"),
      );
      expect(numberingPreviewCalls).toHaveLength(1);
      expect(numberingPreviewCalls[0]![0]).toMatch(/usePrefix=false/);
      expect(
        screen.getByText(/future plain invoices in this workspace for/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/next: 2026002/i)).toBeInTheDocument();
      expect(screen.getByText(/next: 2026011/i)).toBeInTheDocument();
    });
  });

  it("issues a plain Invoice with usePrefix false and numbering strategy", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        const body = JSON.parse(init.body as string) as {
          invoiceNumber?: string;
          usePrefix?: boolean;
        };
        const usePrefix = body.usePrefix !== false;
        const number = body.invoiceNumber ?? (usePrefix ? "BAN2026001" : "2026001");
        return Promise.resolve(
          new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "X-Invoice-Number": number,
              "X-Suggested-Invoice-Number": usePrefix ? "BAN2026001" : "2026001",
              "X-Invoice-Number-Exists": "false",
            },
          }),
        );
      }
      if (url.startsWith("/api/invoices/numbering-preview")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            exists: false,
            suggestedNumber: "2026001",
            nextIfIssued: { sequential: "2026002", fromLast: "2026011" },
          }),
        });
      }
      if (url === "/api/invoices" && init?.method === "POST") {
        return Promise.resolve(issuePdfResponse("2026010"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    fireEvent.click(screen.getByLabelText(/^use prefix$/i));

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("2026001");
    });

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "2026010" },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/continue from this number/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/continue from this number/i));
    fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));

    await waitFor(() => {
      const issueCalls = fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/invoices" && init?.method === "POST",
      );
      expect(issueCalls).toHaveLength(1);
      expect(JSON.parse(issueCalls[0]![1]!.body as string)).toMatchObject({
        clientId: bandaoClient.id,
        from: currentMonthRange().from,
        to: currentMonthRange().to,
        usePrefix: false,
        invoiceNumber: "2026010",
        invoicePrefix: "BAN",
        numberingStrategy: "from_last",
      });
    });

    clickSpy.mockRestore();
  });

  it("loads and saves Invoice Sender settings from a modal", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/workspace/invoice-sender" && init?.method === "PATCH") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            invoiceSender: {
              ...defaultInvoiceSender,
              name: "QA Sender GmbH",
              iban: "DE00 0000 0000 0000 0000 00",
            },
            configured: true,
          }),
        });
      }
      return undefined;
    });

    vi.stubGlobal("fetch", fetchMock);
    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^invoice sender$/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue(defaultInvoiceSender.name)).toBeInTheDocument();
      expect(screen.getByDisplayValue(defaultInvoiceSender.iban)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "QA Sender GmbH" },
    });
    fireEvent.change(screen.getByLabelText(/^iban$/i), {
      target: { value: "DE00 0000 0000 0000 0000 00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            url === "/api/workspace/invoice-sender" &&
            init?.method === "PATCH" &&
            JSON.parse(init.body as string).name === "QA Sender GmbH",
        ),
      ).toBe(true);
      expect(screen.queryByRole("heading", { name: /^invoice sender$/i })).not.toBeInTheDocument();
    });
  });

  it("opens Invoice Sender modal after preview when sender is not configured", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/workspace/invoice-sender" && !init?.method) {
        return invoiceSenderResponse(
          {
            name: "",
            street: "",
            city: "",
            taxNumber: "",
            email: "",
            phone: "",
            bankName: "",
            iban: "",
            bic: "",
          },
          false,
        );
      }
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(
          previewPdfResponse("BAN2026001"),
        );
      }
      return undefined;
    });

    vi.stubGlobal("fetch", fetchMock);
    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^invoice sender$/i })).toBeInTheDocument();
      expect(
        screen.getByText(/add your business details before issuing/i),
      ).toBeInTheDocument();
    });
  });

  it("disables Issue Invoice until Invoice Sender is configured", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/workspace/invoice-sender" && !init?.method) {
        return invoiceSenderResponse(
          {
            name: "",
            street: "",
            city: "",
            taxNumber: "",
            email: "",
            phone: "",
            bankName: "",
            iban: "",
            bic: "",
          },
          false,
        );
      }
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      return undefined;
    });

    vi.stubGlobal("fetch", fetchMock);
    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(screen.getByTitle(/invoice preview/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();
    });
  });
});
