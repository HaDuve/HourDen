import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CloseTheMonthPage from "./CloseTheMonthPage.js";

const bandaoId = "c0000000-0000-4000-8000-000000000001";
const incompleteId = "e0000000-0000-4000-8000-000000000099";

function readinessResponse(overrides: Record<string, unknown> = {}) {
  return {
    from: "2026-10-01",
    to: "2026-10-31",
    invoiceSenderConfigured: true,
    monthClosed: false,
    clients: [
      {
        clientId: bandaoId,
        clientName: "Bandao",
        billableCompleteCount: 1,
        stoppedEntryCount: 2,
        unbilledAmount: 85,
        invoiceStatus: "none",
        missingRecipient: false,
        incompleteEntries: [
          {
            id: incompleteId,
            description: null,
            startedAt: "2026-10-06T10:00:00.000Z",
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createFetchMock(body: unknown = readinessResponse()) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/invoices/month-readiness")) {
      return {
        ok: true,
        json: async () => body,
      };
    }
    if (
      typeof url === "string" &&
      url.startsWith("/api/time-entries/") &&
      init?.method === "PATCH"
    ) {
      return { ok: true, json: async () => ({}) };
    }
    return { ok: false, status: 404, json: async () => ({ error: "not found" }) };
  });
}

function renderPage(path = "/close-the-month?from=2026-10-01&to=2026-10-31") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CloseTheMonthPage />
    </MemoryRouter>,
  );
}

describe("CloseTheMonthPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", createFetchMock());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists Client readiness as text counts with unbilled amount and no meter chrome", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /close the month/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bandao")).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 Billable Complete/i)).toBeInTheDocument();
    expect(screen.getByText(/€85\.00/)).toBeInTheDocument();
    expect(screen.getByText(/no invoice yet/i)).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeNull();
  });

  it("fixes a missing Description inline and refreshes readiness", async () => {
    const fetchMock = createFetchMock();
    let call = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/invoices/month-readiness")) {
        call += 1;
        if (call === 1) {
          return {
            ok: true,
            json: async () => readinessResponse(),
          };
        }
        return {
          ok: true,
          json: async () =>
            readinessResponse({
              clients: [
                {
                  clientId: bandaoId,
                  clientName: "Bandao",
                  billableCompleteCount: 2,
                  stoppedEntryCount: 2,
                  unbilledAmount: 170,
                  invoiceStatus: "none",
                  missingRecipient: false,
                  incompleteEntries: [],
                },
              ],
            }),
        };
      }
      if (
        url === `/api/time-entries/${incompleteId}` &&
        init?.method === "PATCH"
      ) {
        return { ok: true, json: async () => ({ id: incompleteId }) };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "not found" }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    const input = await screen.findByLabelText(/description for incomplete entry/i);
    fireEvent.change(input, { target: { value: "App Development" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 of 2 Billable Complete/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: /preview invoice/i }),
    ).toHaveAttribute(
      "href",
      `/invoices?clientId=${bandaoId}&from=2026-10-01&to=2026-10-31`,
    );
  });

  it("links missing Recipient and Invoice Sender to the fix places", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock(
        readinessResponse({
          invoiceSenderConfigured: false,
          clients: [
            {
              clientId: bandaoId,
              clientName: "Bandao",
              billableCompleteCount: 1,
              stoppedEntryCount: 1,
              unbilledAmount: 85,
              invoiceStatus: "none",
              missingRecipient: true,
              incompleteEntries: [],
            },
          ],
        }),
      ),
    );

    renderPage();

    expect(
      await screen.findByRole("link", { name: /set up invoice sender/i }),
    ).toHaveAttribute("href", "/invoices?editSender=1");
    expect(
      screen.getByRole("link", { name: /fix on clients/i }),
    ).toHaveAttribute("href", `/clients?edit=${bandaoId}`);
  });

  it("shows a Month closed state when nothing is left to invoice", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock(
        readinessResponse({
          monthClosed: true,
          clients: [
            {
              clientId: bandaoId,
              clientName: "Bandao",
              billableCompleteCount: 1,
              stoppedEntryCount: 1,
              unbilledAmount: 0,
              invoiceStatus: "sent",
              missingRecipient: false,
              incompleteEntries: [],
            },
          ],
        }),
      ),
    );

    renderPage();

    expect(await screen.findByRole("status")).toHaveTextContent(/month closed/i);
    expect(
      within(screen.getByRole("status")).queryByRole("link", {
        name: /preview invoice/i,
      }),
    ).not.toBeInTheDocument();
  });
});
