import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { IssuedInvoicesList } from "./IssuedInvoicesList.js";
import { mockDesktopViewport } from "../test/viewport.js";

const issuedInvoice = {
  id: "inv-00000000-0000-4000-8000-000000000001",
  clientId: "client-00000000-0000-4000-8000-000000000001",
  recipient: "BANDAO Guidance GmbH",
  invoiceNumber: "BAN2026001",
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
  totalAmount: 60,
  status: "issued",
};

const sentInvoice = {
  ...issuedInvoice,
  id: "inv-00000000-0000-4000-8000-000000000002",
  invoiceNumber: "BAN2026002",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  status: "sent",
};

const noopAsync = async () => undefined;

const mailLoaders = {
  loadClientMail: vi.fn(async () => ({
    recipientEmail: "billing@bandao.example",
    emailGreetingName: "Anna",
    invoiceEmailSubject: null,
    invoiceEmailBody: null,
  })),
  loadWorkspaceTemplate: vi.fn(async () => ({
    invoiceEmailSubject: null,
    invoiceEmailBody: null,
  })),
};

function stubPdfFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/pdf")) {
        return new Response(new Blob(["%PDF-reader"], { type: "application/pdf" }), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition":
              'attachment; filename="BAN2026001_30_06_26_Invoice.pdf"',
          },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
  URL.createObjectURL = vi.fn((blob: Blob) => {
    void blob;
    return "blob:http://localhost/reader-pdf";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
}

function renderList(
  invoices: typeof issuedInvoice[],
  overrides: Partial<Parameters<typeof IssuedInvoicesList>[0]> = {},
) {
  return render(
    <IssuedInvoicesList
      invoices={invoices}
      downloadingId={null}
      selectedId={invoices[0]!.id}
      onSelect={() => undefined}
      onDownload={() => undefined}
      onRefreshLines={noopAsync}
      onSaveNumber={noopAsync}
      onPrepareEmail={noopAsync}
      onMarkSent={noopAsync}
      onVoid={noopAsync}
      {...mailLoaders}
      formatBillingPeriod={(start, end) => `${start} – ${end}`}
      formatAmount={(amount) => `${amount.toFixed(2)} EUR`}
      pdfUrl={(id) => `/api/invoices/${id}/pdf`}
      {...overrides}
    />,
  );
}

describe("IssuedInvoicesList", () => {
  beforeEach(() => {
    stubPdfFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders a master list grouped by year/month and a PDF reader for the selection", async () => {
    mockDesktopViewport();
    renderList([issuedInvoice]);

    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("June")).toBeInTheDocument();
    expect(screen.getAllByText("BAN2026001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Issued").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^pdf$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^email$/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTitle(/invoice BAN2026001/i)).toHaveAttribute(
        "src",
        "blob:http://localhost/reader-pdf#toolbar=0",
      );
    });
  });

  it("selecting an issued invoice does not download; Download button does", async () => {
    mockDesktopViewport();
    const onDownload = vi.fn();

    function Controlled() {
      const [selectedId, setSelectedId] = useState(issuedInvoice.id);
      return (
        <IssuedInvoicesList
          invoices={[issuedInvoice, sentInvoice]}
          downloadingId={null}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDownload={onDownload}
          onRefreshLines={noopAsync}
          onSaveNumber={noopAsync}
          onPrepareEmail={noopAsync}
          onMarkSent={noopAsync}
          onVoid={noopAsync}
          {...mailLoaders}
          formatBillingPeriod={(start, end) => `${start} – ${end}`}
          formatAmount={(amount) => `${amount.toFixed(2)} EUR`}
          pdfUrl={(id) => `/api/invoices/${id}/pdf`}
        />
      );
    }

    render(<Controlled />);

    await waitFor(() => {
      expect(screen.getByTitle(/invoice BAN2026001/i)).toHaveAttribute(
        "src",
        expect.stringContaining("blob:"),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /BAN2026002/i }));
    expect(onDownload).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByTitle(/invoice BAN2026002/i)).toHaveAttribute(
        "src",
        expect.stringContaining("blob:"),
      );
    });
    expect(onDownload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^download$/i }));
    expect(onDownload).toHaveBeenCalledWith(sentInvoice);
  });

  it("Prepare Email opens Did you send?; Yes marks Sent and No dismisses", async () => {
    mockDesktopViewport();
    const onPrepareEmail = vi.fn(async () => undefined);
    const onMarkSent = vi.fn(async () => undefined);
    renderList([issuedInvoice], { onPrepareEmail, onMarkSent });

    fireEvent.click(screen.getByRole("button", { name: /^email$/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /prepare email/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /prepare email/i }));
    await waitFor(() => {
      expect(onPrepareEmail).toHaveBeenCalledWith(issuedInvoice);
      expect(screen.getByText(/did you send it/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /no — keep issued/i }));
    expect(onMarkSent).not.toHaveBeenCalled();
    expect(screen.queryByText(/did you send it/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /prepare email/i }));
    await waitFor(() => {
      expect(screen.getByText(/did you send it/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /yes — mark sent/i }));
    await waitFor(() => {
      expect(onMarkSent).toHaveBeenCalledWith(issuedInvoice);
    });
  });

  it("Void & replace on a Sent invoice calls onVoid after confirm", async () => {
    mockDesktopViewport();
    const onVoid = vi.fn(async () => undefined);
    renderList([sentInvoice], { onVoid });

    fireEvent.click(screen.getByRole("button", { name: /^email$/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /void & replace/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /void & replace/i }));
    expect(screen.getByText(/void this invoice/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /void invoice/i }));
    await waitFor(() => {
      expect(onVoid).toHaveBeenCalledWith(sentInvoice);
    });
  });
});
