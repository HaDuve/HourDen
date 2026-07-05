import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import InvoicesPage from "./InvoicesPage.js";
import { mockMobileViewport } from "./test/viewport.js";

const bandaoClient = {
  id: "c0000000-0000-4000-8000-000000000001",
  name: "Bandao",
  defaultRate: 60,
  legalName: "BANDAO Guidance GmbH",
  addressLine1: "Schloßbergstraße 1",
  addressLine2: "82319 Starnberg",
  invoicePrefix: null,
};

describe("InvoicesPage mobile layout", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:test") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists issued invoices as cards on mobile", async () => {
    mockMobileViewport();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/clients") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ clients: [bandaoClient] }),
          });
        }
        if (url === "/api/invoices" && !init?.method) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              invoices: [
                {
                  id: "inv-1",
                  recipient: "BANDAO Guidance GmbH",
                  invoiceNumber: "BAN2026001",
                  periodStart: "2026-06-01",
                  periodEnd: "2026-06-30",
                  totalAmount: 60,
                },
              ],
            }),
          });
        }
        if (url === "/api/workspace/invoice-sender") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              invoiceSender: {
                name: "Hannes Duve",
                street: "Am Deichfleet 116",
                city: "28357 Bremen",
                taxNumber: "06044/47008",
                email: "hannes.duve@outlook.com",
                phone: "+49 15734521445",
                bankName: "Deutsche Kreditbank",
                iban: "DE74 120300001060924758",
                bic: "BYLADEM1001",
              },
              configured: true,
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }),
    );

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText("BAN2026001")).toBeInTheDocument();
    });

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("shows invoice preview in a bottom sheet on mobile", async () => {
    mockMobileViewport();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/clients") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ clients: [bandaoClient] }),
          });
        }
        if (url === "/api/invoices" && !init?.method) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ invoices: [] }),
          });
        }
        if (url === "/api/invoices/preview" && init?.method === "POST") {
          return Promise.resolve(
            new Response(new Blob(["%PDF-preview"], { type: "application/pdf" }), {
              status: 200,
              headers: {
                "Content-Type": "application/pdf",
                "X-Invoice-Number": "BAN2026001",
                "X-Suggested-Invoice-Number": "BAN2026001",
                "X-Suggested-Invoice-Prefix": "BAN",
                "X-Invoice-Number-Exists": "false",
              },
            }),
          );
        }
        if (url === "/api/workspace/invoice-sender") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              invoiceSender: {
                name: "Hannes Duve",
                street: "Am Deichfleet 116",
                city: "28357 Bremen",
                taxNumber: "06044/47008",
                email: "hannes.duve@outlook.com",
                phone: "+49 15734521445",
                bankName: "Deutsche Kreditbank",
                iban: "DE74 120300001060924758",
                bic: "BYLADEM1001",
              },
              configured: true,
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }),
    );

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^client$/i)).toHaveValue(bandaoClient.id);
    });

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      const dialog = screen.getByRole("dialog", { name: /invoice preview/i });
      expect(dialog).toHaveAttribute("data-presentation", "sheet");
      expect(within(dialog).getByTitle(/invoice preview/i)).toBeInTheDocument();
    });
  });
});
