import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

const noopAsync = async () => undefined;

describe("IssuedInvoicesList", () => {
  it("renders a master list grouped by year/month and a PDF reader for the selection", () => {
    mockDesktopViewport();
    render(
      <IssuedInvoicesList
        invoices={[issuedInvoice]}
        downloadingId={null}
        selectedId={issuedInvoice.id}
        onSelect={() => undefined}
        onDownload={() => undefined}
        onRefreshLines={noopAsync}
        onSaveNumber={noopAsync}
        onPrepareEmail={noopAsync}
        onMarkSent={noopAsync}
        onVoid={noopAsync}
        loadClientMail={vi.fn(async () => ({
          recipientEmail: "billing@bandao.example",
          emailGreetingName: "Anna",
          invoiceEmailSubject: null,
          invoiceEmailBody: null,
        }))}
        loadWorkspaceTemplate={vi.fn(async () => ({
          invoiceEmailSubject: null,
          invoiceEmailBody: null,
        }))}
        formatBillingPeriod={(start, end) => `${start} – ${end}`}
        formatAmount={(amount) => `${amount.toFixed(2)} EUR`}
        pdfUrl={(id) => `/api/invoices/${id}/pdf`}
      />,
    );

    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("June")).toBeInTheDocument();
    expect(screen.getAllByText("BAN2026001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Issued").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^pdf$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^email$/i })).toBeInTheDocument();
    expect(
      screen.getByTitle(/invoice BAN2026001/i),
    ).toHaveAttribute("src", `/api/invoices/${issuedInvoice.id}/pdf`);
  });
});
