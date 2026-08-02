import { describe, expect, it, vi } from "vitest";
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
      operatorName=""
      pdfUrl={(id) => `/api/invoices/${id}/pdf`}
      {...overrides}
    />,
  );
}

describe("IssuedInvoicesList", () => {
  it("renders a master list grouped by year/month and a PDF reader for the selection", () => {
    mockDesktopViewport();
    renderList([issuedInvoice]);

    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("June")).toBeInTheDocument();
    expect(screen.getAllByText("BAN2026001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Issued").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^pdf$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^email$/i })).toBeInTheDocument();
    expect(screen.getByTitle(/invoice BAN2026001/i)).toHaveAttribute(
      "src",
      `/api/invoices/${issuedInvoice.id}/pdf#toolbar=0`,
    );
  });

  it("Reader PDF toolbar has Fullscreen next to Download", () => {
    mockDesktopViewport();
    renderList([issuedInvoice]);

    const fullscreen = screen.getByRole("button", {
      name: /fullscreen invoice/i,
    });
    const download = screen.getByRole("button", {
      name: /download invoice BAN2026001/i,
    });

    expect(
      fullscreen.compareDocumentPosition(download) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(fullscreen);

    expect(
      screen.getByRole("dialog", { name: /fullscreen invoice/i }),
    ).toBeInTheDocument();
    expect(screen.getByTitle(/^fullscreen invoice$/i)).toHaveAttribute(
      "src",
      `/api/invoices/${issuedInvoice.id}/pdf#toolbar=0`,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /close fullscreen invoice/i }),
    );
    expect(
      screen.queryByRole("dialog", { name: /fullscreen invoice/i }),
    ).not.toBeInTheDocument();
  });

  it("closes the Reader fullscreen dialog when Escape is pressed", () => {
    mockDesktopViewport();
    renderList([issuedInvoice]);

    fireEvent.click(
      screen.getByRole("button", { name: /fullscreen invoice/i }),
    );
    expect(
      screen.getByRole("dialog", { name: /fullscreen invoice/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: /fullscreen invoice/i }),
    ).not.toBeInTheDocument();
  });

  it("selecting an issued invoice shows Reader PDF and does not call Download", async () => {
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
          operatorName=""
          pdfUrl={(id) => `/api/invoices/${id}/pdf`}
        />
      );
    }

    render(<Controlled />);

    expect(screen.getByTitle(/invoice BAN2026001/i)).toHaveAttribute(
      "src",
      `/api/invoices/${issuedInvoice.id}/pdf#toolbar=0`,
    );

    fireEvent.click(screen.getByRole("button", { name: /BAN2026002/i }));
    expect(onDownload).not.toHaveBeenCalled();
    expect(screen.getByTitle(/invoice BAN2026002/i)).toHaveAttribute(
      "src",
      `/api/invoices/${sentInvoice.id}/pdf#toolbar=0`,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /download invoice BAN2026002/i }),
    );
    expect(onDownload).toHaveBeenCalledWith(sentInvoice);
  });

  it("Prepare Email asks whether the mail app opened before Did you send", async () => {
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
      expect(screen.getByText(/did your mail app open/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/did you send it/i)).not.toBeInTheDocument();
    expect(onMarkSent).not.toHaveBeenCalled();
  });

  it("mail opened Yes then Did you send Yes marks Sent; No keeps Issued", async () => {
    mockDesktopViewport();
    const onMarkSent = vi.fn(async () => undefined);
    renderList([issuedInvoice], { onMarkSent });

    fireEvent.click(screen.getByRole("button", { name: /^email$/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /prepare email/i }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /prepare email/i }));
    await waitFor(() => {
      expect(screen.getByText(/did your mail app open/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /yes — mail opened/i }));
    expect(screen.getByText(/did you send it/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /no — keep issued/i }));
    expect(onMarkSent).not.toHaveBeenCalled();
    expect(screen.queryByText(/did you send it/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /prepare email/i }));
    await waitFor(() => {
      expect(screen.getByText(/did your mail app open/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /yes — mail opened/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes — mark sent/i }));
    await waitFor(() => {
      expect(onMarkSent).toHaveBeenCalledWith(issuedInvoice);
    });
  });

  it("mail did not open shows Default email reader tip and keeps Issued", async () => {
    mockDesktopViewport();
    const onMarkSent = vi.fn(async () => undefined);
    renderList([issuedInvoice], { onMarkSent });

    fireEvent.click(screen.getByRole("button", { name: /^email$/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /prepare email/i }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /prepare email/i }));
    await waitFor(() => {
      expect(screen.getByText(/did your mail app open/i)).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /no — mail didn’t open/i }),
    );
    expect(screen.getByText(/default email reader/i)).toBeInTheDocument();
    expect(onMarkSent).not.toHaveBeenCalled();
    expect(screen.queryByText(/did you send it/i)).not.toBeInTheDocument();
  });

  it("email tab offers Copy draft and Open mail app mailto link", async () => {
    mockDesktopViewport();
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderList([issuedInvoice], { operatorName: "Hannes" });

    fireEvent.click(screen.getByRole("button", { name: /^email$/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /open mail app/i }),
      ).toBeInTheDocument();
    });

    const openLink = screen.getByRole("link", { name: /open mail app/i });
    expect(openLink).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:billing%40bandao\.example\?/),
    );

    fireEvent.click(screen.getByRole("button", { name: /copy draft/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/Invoice June 2026[\s\S]*Hello Anna,[\s\S]*Hannes/),
    );
  });

  it("email tab shows filled locale default draft when none is saved", async () => {
    mockDesktopViewport();
    renderList([issuedInvoice], { operatorName: "Hannes" });

    fireEvent.click(screen.getByRole("button", { name: /^email$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Invoice June 2026/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Hello Anna,/)).toBeInTheDocument();
    expect(screen.getByText(/invoice for June 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Hannes/)).toBeInTheDocument();
    expect(screen.queryByText(/\{\{billingMonth\}\}/)).not.toBeInTheDocument();
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
