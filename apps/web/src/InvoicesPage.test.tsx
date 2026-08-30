import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "./i18n/i18n.js";
import InvoicesPage from "./InvoicesPage.js";
import { createMatchMediaWithOptions } from "./test/match-media.js";
import { createPreviewThenBillingMonthConflictHandler } from "./invoices/invoices-page-preview-fetch.js";
import { POST_ISSUE_PREPARE_EMAIL_BLINK_MS } from "./invoices/post-issue-email-handoff.js";

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
  invoiceNumberSeqBeforeYear: false,
  recipientEmail: null as string | null,
  emailGreetingName: null as string | null,
  invoiceEmailSubject: null as string | null,
  invoiceEmailBody: null as string | null,
};

const clientWithoutRecipient = {
  id: "c0000000-0000-4000-8000-000000000002",
  name: "Hannah",
  defaultRate: 80,
  legalName: null,
  addressLine1: null,
  addressLine2: null,
  invoicePrefix: null,
  invoiceNumberSeqBeforeYear: false,
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

function workspaceEmailTemplateResponse() {
  return Promise.resolve({
    ok: true,
    json: async () => ({
      invoiceEmailSubject: null,
      invoiceEmailBody: null,
    }),
  });
}

function clientByIdResponse(client: typeof bandaoClient) {
  return Promise.resolve({
    ok: true,
    json: async () => client,
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
    if (url === "/api/workspace/invoice-email-template") {
      return workspaceEmailTemplateResponse();
    }
    const clientMatch = url.match(/^\/api\/clients\/([^/]+)$/);
    if (clientMatch) {
      const client = clients.find(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "id" in entry &&
          entry.id === clientMatch[1],
      );
      if (client) return clientByIdResponse(client as typeof bandaoClient);
    }
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
      "Content-Disposition":
        'attachment; filename="BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf"',
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

async function waitForAutoPreview() {
  await waitFor(() => {
    expect(screen.getByTitle(/invoice preview/i)).toBeInTheDocument();
  });
}

function previewRegion() {
  return screen.getByRole("region", { name: /invoice preview/i });
}

function advancedSettingsSummaryPattern() {
  return /^(more settings|weitere einstellungen)$/i;
}

function advancedSettingsDisclosure() {
  const summary = screen.getByText(advancedSettingsSummaryPattern());
  const details = summary.closest("details");
  if (!details) {
    throw new Error("More settings disclosure not found");
  }
  return details;
}

function expandAdvancedSettings() {
  const details = advancedSettingsDisclosure();
  if (!details.hasAttribute("open")) {
    fireEvent.click(screen.getByText(advancedSettingsSummaryPattern()));
  }
}

function withinAdvancedSettings() {
  return within(advancedSettingsDisclosure());
}

function clickAdvancedSetting(label: RegExp) {
  expandAdvancedSettings();
  fireEvent.click(withinAdvancedSettings().getByLabelText(label));
}

function clickAdvancedCheckbox(name: RegExp) {
  expandAdvancedSettings();
  fireEvent.click(withinAdvancedSettings().getByRole("checkbox", { name }));
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

  it("does not show Invoice Sender in the page header", async () => {
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);

    const headerActions = screen.getByRole("button", { name: /^issue invoice$/i })
      .parentElement;
    expect(headerActions).toBeTruthy();
    expect(
      within(headerActions!).queryByRole("button", { name: /^invoice sender$/i }),
    ).not.toBeInTheDocument();
  });

  it("hides advanced invoice settings inside a closed More settings disclosure by default", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

    const disclosure = advancedSettingsDisclosure();
    expect(within(disclosure).queryByLabelText(/^use prefix$/i)).not.toBeVisible();
    expect(
      within(disclosure).queryByLabelText(/^sequence before year$/i),
    ).not.toBeVisible();
    expect(
      within(disclosure).queryByRole("checkbox", {
        name: /uses kleinunternehmerregelung/i,
      }),
    ).not.toBeVisible();
    expect(
      within(disclosure).queryByRole("button", { name: /^invoice sender$/i }),
    ).not.toBeVisible();
  });

  it("keeps Invoice Number and Invoice Prefix visible outside the disclosure after preview", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

    expect(screen.getByLabelText(/^invoice number$/i)).toBeVisible();
    expect(screen.getByLabelText(/^invoice prefix$/i)).toBeVisible();
    expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
  });

  it("re-runs preview when an advanced setting changes inside the disclosure", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

    const callsBefore = fetchMock.mock.calls.filter(
      ([url, init]) => url === "/api/invoices/preview" && init?.method === "POST",
    ).length;

    expandAdvancedSettings();
    fireEvent.click(
      within(advancedSettingsDisclosure()).getByLabelText(/^use prefix$/i),
    );

    await waitFor(() => {
      const callsAfter = fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/invoices/preview" && init?.method === "POST",
      ).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });

  it("shows Weitere Einstellungen when the active locale is de", async () => {
    await i18n.changeLanguage("de");
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));

    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText(/^weitere einstellungen$/i)).toBeInTheDocument();
    });
  });

  it("does not show a manual Preview button in the header", async () => {
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);

    expect(
      screen.queryByRole("button", { name: /^preview$/i }),
    ).not.toBeInTheDocument();
  });

  it("auto-runs preview once clients are loaded", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

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
  });

  it("auto-runs preview again when the billing period changes", async () => {
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));
    vi.setSystemTime(new Date(2026, 5, 18));

    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();
    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

    const callsBefore = fetchMock.mock.calls.filter(
      ([url, init]) => url === "/api/invoices/preview" && init?.method === "POST",
    ).length;

    fireEvent.click(screen.getByRole("button", { name: /^last month$/i }));

    await waitFor(() => {
      const callsAfter = fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/invoices/preview" && init?.method === "POST",
      ).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });

  it("clears the stale PDF when a re-preview fails with a blocker", async () => {
    let previewCallCount = 0;
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        previewCallCount += 1;
        if (previewCallCount === 1) {
          return Promise.resolve(previewPdfResponse("BAN2026001"));
        }
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
    await waitForAutoPreview();
    expect(screen.getByTitle(/invoice preview/i)).toBeInTheDocument();

    expandAdvancedSettings();
    fireEvent.click(
      within(advancedSettingsDisclosure()).getByLabelText(/^use prefix$/i),
    );

    await waitFor(() => {
      expect(screen.queryByTitle(/invoice preview/i)).not.toBeInTheDocument();
      expect(
        within(previewRegion()).getByRole("link", { name: /^tracker$/i }),
      ).toHaveAttribute("href", "/tracker");
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();
    });
  });

  it("clears the stale PDF when a re-preview fails with a transport error", async () => {
    let previewCallCount = 0;
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        previewCallCount += 1;
        if (previewCallCount === 1) {
          return Promise.resolve(previewPdfResponse("BAN2026001"));
        }
        return Promise.reject(new Error("offline"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();
    expect(screen.getByTitle(/invoice preview/i)).toBeInTheDocument();

    expandAdvancedSettings();
    fireEvent.click(
      within(advancedSettingsDisclosure()).getByLabelText(/^use prefix$/i),
    );

    await waitFor(() => {
      expect(screen.queryByTitle(/invoice preview/i)).not.toBeInTheDocument();
      expect(
        within(previewRegion()).getByText(/failed to preview invoice/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^retry$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();
    });
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
    expandAdvancedSettings();
    fireEvent.click(
      within(advancedSettingsDisclosure()).getByRole("button", {
        name: /^rechnungsabsender$/i,
      }),
    );

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
    await waitForAutoPreview();

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    expandAdvancedSettings();
    expect(withinAdvancedSettings().getByLabelText(/^use prefix$/i)).toBeChecked();

    clickAdvancedSetting(/^use prefix$/i);

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

  it("hides Invoice Prefix in the main flow when Use prefix is off", async () => {
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
    await waitForAutoPreview();

    expect(screen.getByLabelText(/^invoice prefix$/i)).toBeVisible();

    clickAdvancedSetting(/^use prefix$/i);

    await waitFor(() => {
      expect(screen.queryByLabelText(/^invoice prefix$/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("2026001");
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

    await waitFor(() => {
      expect(
        within(previewRegion()).getByText(/something went wrong/i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links to the Clients page when preview fails because Recipient fields are missing", async () => {
    vi.stubGlobal("fetch", clientsFetchMock([clientWithoutRecipient]));

    renderInvoicesPage();

    await waitForClientReady("Hannah", clientWithoutRecipient.id);
    await waitFor(() => {
      expect(
        within(previewRegion()).getByRole("link", { name: /clients page/i }),
      ).toHaveAttribute("href", `/clients?edit=${clientWithoutRecipient.id}`);
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
    await waitForAutoPreview();
    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeEnabled();
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
      expect(
        within(previewRegion()).getByRole("link", { name: /clients page/i }),
      ).toHaveAttribute("href", "/clients?new=1");
    });
  });

  it("shows a quiet billing-month conflict in the preview pane", async () => {
    vi.stubGlobal(
      "fetch",
      createInvoicesPageFetchMock([bandaoClient], (url, init) => {
        if (url === "/api/invoices/preview" && init?.method === "POST") {
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

    await waitFor(() => {
      expect(
        within(previewRegion()).getByText(
          /invoice already exists for this client and billing month/i,
        ),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an inline error for a duplicate Billing Period on issue", async () => {
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
    await waitForAutoPreview();
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

  it("shows an inline error for a duplicate billing month on issue", async () => {
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
    await waitForAutoPreview();
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
    await waitForAutoPreview();

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
      expect(screen.getByTitle(/invoice preview/i)).toHaveAttribute(
        "src",
        "blob:test#toolbar=0",
      );
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

  it("downloads the preview PDF using the Content-Disposition filename, not a blob UUID", async () => {
    const expectedFilename =
      "BAN2026001_30_06_26_Invoice_Hannes_Duve_BANDAO.pdf";
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);
    let downloadedAs: string | undefined;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedAs = this.download;
      });

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /download preview pdf/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /download preview pdf/i }),
    );

    await waitFor(() => {
      expect(downloadedAs).toBe(expectedFilename);
    });
    expect(downloadedAs).not.toMatch(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}){1,2}(\.pdf)?$/i,
    );

    clickSpy.mockRestore();
  });

  it("opens the preview PDF in a fullscreen dialog", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /fullscreen preview/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /fullscreen preview/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /fullscreen preview/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByTitle(/^fullscreen preview$/i),
      ).toHaveAttribute("src", "blob:test#toolbar=0");
    });

    fireEvent.click(
      screen.getByRole("button", { name: /close fullscreen preview/i }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /fullscreen preview/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("closes the fullscreen preview when Escape is pressed", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /fullscreen preview/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /fullscreen preview/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /fullscreen preview/i }),
      ).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /fullscreen preview/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("sends invoiceNumberSeqBeforeYear when sequence-before-year is enabled", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN-001-2026"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

    const callsBefore = fetchMock.mock.calls.filter(
      ([url, init]) => url === "/api/invoices/preview" && init?.method === "POST",
    ).length;

    clickAdvancedSetting(/^sequence before year$/i);

    await waitFor(() => {
      const previewCalls = fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/invoices/preview" && init?.method === "POST",
      );
      expect(previewCalls.length).toBeGreaterThan(callsBefore);
      const bodies = previewCalls.map((call) =>
        JSON.parse(call[1]!.body as string) as {
          invoiceNumberSeqBeforeYear?: boolean;
        },
      );
      expect(
        bodies.some((body) => body.invoiceNumberSeqBeforeYear === true),
      ).toBe(true);
    });
  });

  it("sends usesSmallBusinessRule false on preview when the checkbox is unchecked", async () => {
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return Promise.resolve(previewPdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

    clickAdvancedCheckbox(/uses kleinunternehmerregelung/i);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/invoices/preview",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            clientId: bandaoClient.id,
            from: currentMonthRange().from,
            to: currentMonthRange().to,
            usesSmallBusinessRule: false,
          }),
        }),
      );
    });
  });

  it("disables invoice prefix and number fields until the first preview succeeds", async () => {
    let resolvePreview!: (value: Response) => void;
    const previewGate = new Promise<Response>((resolve) => {
      resolvePreview = resolve;
    });
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices/preview" && init?.method === "POST") {
        return previewGate;
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);

    expect(screen.queryByLabelText(/^invoice prefix$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^invoice number$/i)).not.toBeInTheDocument();

    resolvePreview(previewPdfResponse("BAN2026001"));
    await waitForAutoPreview();

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toBeEnabled();
      expect(screen.getByLabelText(/^invoice number$/i)).toBeEnabled();
    });
  });

  it("keeps Issue Invoice disabled until preview succeeds for the current selection", async () => {
    let resolvePreview!: (value: Response) => void;
    const previewGate = new Promise<Response>((resolve) => {
      resolvePreview = resolve;
    });
    vi.stubGlobal(
      "fetch",
      createInvoicesPageFetchMock([bandaoClient], (url, init) => {
        if (url === "/api/invoices/preview" && init?.method === "POST") {
          return previewGate;
        }
        return undefined;
      }),
    );

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);

    expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();

    resolvePreview(previewPdfResponse("BAN2026001"));
    await waitForAutoPreview();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeEnabled();
    });
  });

  it("issues the invoice without downloading the PDF", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const previewHandler = createPreviewThenBillingMonthConflictHandler(() =>
      previewPdfResponse("BAN2026001"),
    );
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      const preview = previewHandler(url, init);
      if (preview !== undefined) return preview;
      if (url === "/api/invoices" && init?.method === "POST") {
        return Promise.resolve(issuePdfResponse("BAN2026001"));
      }
      if (url === "/api/invoices" && !init?.method) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            invoices: [
              {
                id: "inv-1",
                clientId: bandaoClient.id,
                recipient: "BANDAO Guidance GmbH",
                invoiceNumber: "BAN2026001",
                periodStart: currentMonthRange().from,
                periodEnd: currentMonthRange().to,
                totalAmount: 60,
                status: "issued",
              },
            ],
          }),
        });
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();
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
      expect(clickSpy).not.toHaveBeenCalled();
      expect(screen.queryByTitle(/invoice preview/i)).not.toBeInTheDocument();
      expect(
        within(previewRegion()).getByText(
          /invoice already exists for this client and billing month/i,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByTestId("issued-invoice-email-panel")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^email$/i })).toHaveClass(
        "border-b-2",
      );
    });

    clickSpy.mockRestore();
  });

  it("after issue opens Email tab and blinks Prepare Email when recipient email exists", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = createMatchMediaWithOptions({
      wide: true,
      reducedMotion: false,
    }) as typeof window.matchMedia;
    const bandaoWithEmail = {
      ...bandaoClient,
      recipientEmail: "billing@bandao.example",
    };
    const previewHandler = createPreviewThenBillingMonthConflictHandler(() =>
      previewPdfResponse("BAN2026001"),
    );
    const fetchMock = createInvoicesPageFetchMock([bandaoWithEmail], (url, init) => {
      const preview = previewHandler(url, init);
      if (preview !== undefined) return preview;
      if (url === "/api/invoices" && init?.method === "POST") {
        return Promise.resolve(issuePdfResponse("BAN2026001"));
      }
      if (url === "/api/invoices" && !init?.method) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            invoices: [
              {
                id: "inv-1",
                clientId: bandaoWithEmail.id,
                recipient: "BANDAO Guidance GmbH",
                invoiceNumber: "BAN2026001",
                periodStart: currentMonthRange().from,
                periodEnd: currentMonthRange().to,
                totalAmount: 60,
                status: "issued",
              },
            ],
          }),
        });
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);

    renderInvoicesPage();
    await waitForClientReady("Bandao", bandaoWithEmail.id);
    await waitForAutoPreview();
    fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));

    await waitFor(() => {
      expect(screen.getByTestId("issued-invoice-email-panel")).toBeInTheDocument();
    });

    const prepareButton = screen.getByRole("button", { name: /prepare email/i });
    expect(prepareButton).toHaveClass("prepare-email-attention");

    await waitFor(
      () => {
        expect(prepareButton).not.toHaveClass("prepare-email-attention");
      },
      { timeout: POST_ISSUE_PREPARE_EMAIL_BLINK_MS + 500 },
    );
  });

  async function previewAndIssue(invoiceNumber = "BAN2026001") {
    const previewHandler = createPreviewThenBillingMonthConflictHandler(() =>
      previewPdfResponse(invoiceNumber),
    );
    vi.stubGlobal(
      "fetch",
      createInvoicesPageFetchMock([bandaoClient], (url, init) => {
        const preview = previewHandler(url, init);
        if (preview !== undefined) return preview;
        if (url === "/api/invoices" && init?.method === "POST") {
          return Promise.resolve(issuePdfResponse(invoiceNumber));
        }
        return undefined;
      }),
    );

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));
  }

  it("issues when the API omits X-Invoice-Export-Path", async () => {
    const previewHandler = createPreviewThenBillingMonthConflictHandler(() =>
      previewPdfResponse("BAN2026001"),
    );
    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      const preview = previewHandler(url, init);
      if (preview !== undefined) return preview;
      if (url === "/api/invoices" && init?.method === "POST") {
        return Promise.resolve(issuePdfResponse("BAN2026001"));
      }
      return undefined;
    });
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /^issue invoice$/i }));

    await waitFor(() => {
      expect(clickSpy).not.toHaveBeenCalled();
      expect(
        screen.queryByText(/pdf saved to the archive folder/i),
      ).not.toBeInTheDocument();
    });

    clickSpy.mockRestore();
  });

  it("does not show archive folder controls on the issued-invoices section", async () => {
    vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));

    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /issued invoices/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /download all outgoing invoices/i }),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(/archive folder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/archivordner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/local archive filing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lokale archivablage/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /choose archive folder/i }),
    ).not.toBeInTheDocument();
  });

  it("after Issue shows a quiet preview state without archive outcome banners", async () => {
    await previewAndIssue();

    await waitFor(() => {
      expect(
        within(previewRegion()).getByText(
          /invoice already exists for this client and billing month/i,
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/pdf saved to the archive folder/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/no archive folder is set/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /choose folder & file pdf/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("lists issued invoices and re-downloads a PDF", async () => {
    const issuedInvoice = {
      id: "inv-00000000-0000-4000-8000-000000000001",
      clientId: bandaoClient.id,
      recipient: "BANDAO Guidance GmbH",
      invoiceNumber: "BAN2026001",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      totalAmount: 60,
      status: "issued",
    };

    const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
      if (url === "/api/invoices" && !init?.method) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ invoices: [issuedInvoice] }),
        });
      }
      if (url === `/api/clients/${bandaoClient.id}`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...bandaoClient,
            recipientEmail: "billing@bandao.example",
            emailGreetingName: "Anna",
            invoiceEmailSubject: null,
            invoiceEmailBody: null,
          }),
        });
      }
      if (url === "/api/workspace/invoice-email-template") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            invoiceEmailSubject: null,
            invoiceEmailBody: null,
          }),
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
      expect(screen.getAllByText("BANDAO Guidance GmbH").length).toBeGreaterThan(0);
      expect(screen.getAllByText("BAN2026001").length).toBeGreaterThan(0);
      expect(screen.getByText(/06\/01\/2026/)).toBeInTheDocument();
      expect(screen.getByText(/€60\.00/)).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /download invoice BAN2026001/i }),
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
    fireEvent.click(
      screen.getByRole("button", { name: /download all outgoing invoices/i }),
    );

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
    await waitForAutoPreview();

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
    await waitForAutoPreview();

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
    await waitForAutoPreview();

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
    await waitForAutoPreview();

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
    await waitForAutoPreview();

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "2026010" },
    });

    await waitFor(() => {
      expandAdvancedSettings();
      expect(
        withinAdvancedSettings().getByText(/continue suggested sequence/i),
      ).toBeInTheDocument();
      expect(withinAdvancedSettings().getByText(/next: BAN2026002/i)).toBeInTheDocument();
      expect(
        withinAdvancedSettings().getByText(/continue from this number/i),
      ).toBeInTheDocument();
      expect(withinAdvancedSettings().getByText(/next: BAN2026001/i)).toBeInTheDocument();
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
    await waitForAutoPreview();

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "2026010" },
    });

    await waitFor(() => {
      expandAdvancedSettings();
      expect(
        withinAdvancedSettings().getByText(/continue suggested sequence/i),
      ).toBeInTheDocument();
    });

    expandAdvancedSettings();
    fireEvent.click(
      withinAdvancedSettings().getByLabelText(/continue from this number/i),
    );

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "BAN2026001" },
    });

    await waitFor(() => {
      expandAdvancedSettings();
      expect(
        withinAdvancedSettings().queryByText(/continue suggested sequence/i),
      ).not.toBeInTheDocument();
      expect(
        withinAdvancedSettings().queryByText(/continue from this number/i),
      ).not.toBeInTheDocument();
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

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice prefix$/i)).toHaveValue("BAN");
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "2026010" },
    });

    await waitFor(() => {
      expandAdvancedSettings();
      expect(
        withinAdvancedSettings().getByLabelText(/continue from this number/i),
      ).toBeInTheDocument();
    });

    expandAdvancedSettings();
    fireEvent.click(
      withinAdvancedSettings().getByLabelText(/continue from this number/i),
    );
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
    await waitForAutoPreview();

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    clickAdvancedSetting(/^use prefix$/i);

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
      expandAdvancedSettings();
      expect(
        withinAdvancedSettings().getByText(/future plain invoices in this workspace for/i),
      ).toBeInTheDocument();
      expect(withinAdvancedSettings().getByText(/next: 2026002/i)).toBeInTheDocument();
      expect(withinAdvancedSettings().getByText(/next: 2026011/i)).toBeInTheDocument();
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

    renderInvoicesPage();

    await waitForClientReady("Bandao", bandaoClient.id);
    await waitForAutoPreview();

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("BAN2026001");
    });

    clickAdvancedSetting(/^use prefix$/i);

    await waitFor(() => {
      expect(screen.getByLabelText(/^invoice number$/i)).toHaveValue("2026001");
    });

    fireEvent.change(screen.getByLabelText(/^invoice number$/i), {
      target: { value: "2026010" },
    });

    await waitFor(() => {
      expandAdvancedSettings();
      expect(
        withinAdvancedSettings().getByLabelText(/continue from this number/i),
      ).toBeInTheDocument();
    });

    expandAdvancedSettings();
    fireEvent.click(
      withinAdvancedSettings().getByLabelText(/continue from this number/i),
    );
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
    expandAdvancedSettings();
    fireEvent.click(
      within(advancedSettingsDisclosure()).getByRole("button", {
        name: /^invoice sender$/i,
      }),
    );

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

  it("does not open Invoice Sender modal automatically after auto-preview when sender is not configured", async () => {
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
    await waitForAutoPreview();

    expect(
      screen.queryByRole("heading", { name: /^invoice sender$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();
  });

  describe("Invoices page layout", () => {
    it("keeps the page header title-only without Issue Invoice", async () => {
      vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));

      renderInvoicesPage();
      await waitForClientReady("Bandao", bandaoClient.id);

      const header = screen.getByTestId("invoices-page-header");
      expect(within(header).getByRole("heading", { level: 1 })).toHaveTextContent(
        /invoices/i,
      );
      expect(
        within(header).queryByRole("button", { name: /^issue invoice$/i }),
      ).not.toBeInTheDocument();
    });

    it("places Issue Invoice directly under the preview region", async () => {
      const fetchMock = createInvoicesPageFetchMock([bandaoClient], (url, init) => {
        if (url === "/api/invoices/preview" && init?.method === "POST") {
          return Promise.resolve(previewPdfResponse("BAN2026001"));
        }
        return undefined;
      });
      vi.stubGlobal("fetch", fetchMock);

      renderInvoicesPage();
      await waitForClientReady("Bandao", bandaoClient.id);
      await waitForAutoPreview();

      const preview = previewRegion();
      const issueButton = screen.getByRole("button", { name: /^issue invoice$/i });
      expect(
        preview.compareDocumentPosition(issueButton) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("shows issued invoices below compose content in a single column", async () => {
      vi.stubGlobal("fetch", createInvoicesPageFetchMock([bandaoClient]));

      renderInvoicesPage();
      await waitForClientReady("Bandao", bandaoClient.id);

      expect(screen.queryByTestId("invoices-layout")).not.toBeInTheDocument();

      const issueButton = screen.getByRole("button", { name: /^issue invoice$/i });
      const issuedHeading = screen.getByRole("heading", { name: /issued invoices/i });
      expect(
        issueButton.compareDocumentPosition(issuedHeading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
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
    await waitForAutoPreview();

    await waitFor(() => {
      expect(screen.getByTitle(/invoice preview/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^issue invoice$/i })).toBeDisabled();
    });
  });
});
