import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { InvoicePreviewPane } from "./InvoicePreviewPane.js";

const noop = () => {};

describe("InvoicePreviewPane", () => {
  it("shows a quiet blocker with a deep link in the preview region", () => {
    render(
      <MemoryRouter>
        <InvoicePreviewPane
          previewing={false}
          previewUrl={null}
          previewAlert={{
            kind: "blocker",
            code: "MISSING_RECIPIENT",
            clientId: "client-1",
          }}
          previewIframeSrc={(url) => url}
          buttonClass="btn"
          onDownload={noop}
          onFullscreen={noop}
        />
      </MemoryRouter>,
    );

    const region = screen.getByRole("region", { name: /invoice preview/i });
    expect(
      screen.getByRole("link", { name: /clients page/i }),
    ).toHaveAttribute("href", "/clients?edit=client-1");
    expect(region).toContainElement(
      screen.getByRole("link", { name: /clients page/i }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a quiet billing-month conflict without an alert role", () => {
    render(
      <MemoryRouter>
        <InvoicePreviewPane
          previewing={false}
          previewUrl={null}
          previewAlert={{
            kind: "plain",
            message:
              "Invoice already exists for this Client and billing month",
          }}
          previewIframeSrc={(url) => url}
          buttonClass="btn"
          onDownload={noop}
          onFullscreen={noop}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/already exists for this client and billing month/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers retry after a transport failure", () => {
    const onRetry = vi.fn();

    render(
      <MemoryRouter>
        <InvoicePreviewPane
          previewing={false}
          previewUrl={null}
          previewAlert={{
            kind: "plain",
            message: "Failed to preview invoice",
            canRetry: true,
          }}
          previewIframeSrc={(url) => url}
          buttonClass="btn"
          onDownload={noop}
          onFullscreen={noop}
          onRetry={onRetry}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^retry$/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
