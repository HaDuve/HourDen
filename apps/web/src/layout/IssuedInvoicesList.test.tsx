import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssuedInvoicesList } from "./IssuedInvoicesList.js";
import { mockDesktopViewport, mockMobileViewport } from "../test/viewport.js";

const issuedInvoice = {
  id: "inv-00000000-0000-4000-8000-000000000001",
  recipient: "BANDAO Guidance GmbH",
  invoiceNumber: "BAN2026001",
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
  totalAmount: 60,
};

describe("IssuedInvoicesList", () => {
  it("renders cards instead of a table on mobile", () => {
    mockMobileViewport();
    render(
      <IssuedInvoicesList
        invoices={[issuedInvoice]}
        downloadingId={null}
        onDownload={() => undefined}
        formatBillingPeriod={(start, end) => `${start} – ${end}`}
        formatAmount={(amount) => `${amount.toFixed(2)} EUR`}
      />,
    );

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("BANDAO Guidance GmbH")).toBeInTheDocument();
    expect(screen.getByText("BAN2026001")).toBeInTheDocument();
  });

  it("renders a table on desktop", () => {
    mockDesktopViewport();
    render(
      <IssuedInvoicesList
        invoices={[issuedInvoice]}
        downloadingId={null}
        onDownload={() => undefined}
        formatBillingPeriod={(start, end) => `${start} – ${end}`}
        formatAmount={(amount) => `${amount.toFixed(2)} EUR`}
      />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders issued invoice column labels from the message catalog", () => {
    mockDesktopViewport();
    render(
      <IssuedInvoicesList
        invoices={[issuedInvoice]}
        downloadingId={null}
        onDownload={() => undefined}
        formatBillingPeriod={(start, end) => `${start} – ${end}`}
        formatAmount={(amount) => `${amount.toFixed(2)} EUR`}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /^recipient$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^invoice number$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^billing period$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^total$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download invoice BAN2026001/i }),
    ).toBeInTheDocument();
  });

  it("right-aligns invoice totals with tabular numeric styling on desktop", () => {
    mockDesktopViewport();
    render(
      <IssuedInvoicesList
        invoices={[issuedInvoice]}
        downloadingId={null}
        onDownload={() => undefined}
        formatBillingPeriod={(start, end) => `${start} – ${end}`}
        formatAmount={(amount) => `${amount.toFixed(2)} EUR`}
      />,
    );

    const totalCell = screen.getByRole("cell", { name: /60\.00 EUR/ });
    expect(totalCell).toHaveClass("tabular-nums", "font-mono", "text-right");
  });

  it("right-aligns invoice totals with tabular numeric styling on mobile cards", () => {
    mockMobileViewport();
    render(
      <IssuedInvoicesList
        invoices={[issuedInvoice]}
        downloadingId={null}
        onDownload={() => undefined}
        formatBillingPeriod={(start, end) => `${start} – ${end}`}
        formatAmount={(amount) => `${amount.toFixed(2)} EUR`}
      />,
    );

    const totalValue = screen.getByText("60.00 EUR");
    expect(totalValue).toHaveClass("tabular-nums", "font-mono", "text-right");
  });
});
