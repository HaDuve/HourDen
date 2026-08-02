import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InvoicePdfToolbar } from "./InvoicePdfToolbar.js";
import { secondaryButtonClass } from "./ui-classes.js";

describe("InvoicePdfToolbar", () => {
  it("renders Fullscreen next to Download with icons and wires clicks", () => {
    const onFullscreen = vi.fn();
    const onDownload = vi.fn();

    render(
      <InvoicePdfToolbar
        buttonClass={secondaryButtonClass}
        fullscreenAriaLabel="Fullscreen invoice"
        downloadAriaLabel="Download invoice"
        onFullscreen={onFullscreen}
        onDownload={onDownload}
      />,
    );

    const fullscreen = screen.getByRole("button", {
      name: /fullscreen invoice/i,
    });
    const download = screen.getByRole("button", {
      name: /download invoice/i,
    });

    expect(fullscreen.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(download.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(
      fullscreen.compareDocumentPosition(download) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(fullscreen);
    fireEvent.click(download);
    expect(onFullscreen).toHaveBeenCalledOnce();
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("shows downloading label and disables Download when busy", () => {
    render(
      <InvoicePdfToolbar
        buttonClass={secondaryButtonClass}
        downloadAriaLabel="Download invoice"
        downloadDisabled
        downloading
        onDownload={() => undefined}
      />,
    );

    const download = screen.getByRole("button", {
      name: /download invoice/i,
    });
    expect(download).toBeDisabled();
    expect(download).toHaveTextContent(/downloading/i);
  });

  it("renders Close when onClose is provided", () => {
    const onClose = vi.fn();
    render(
      <InvoicePdfToolbar
        buttonClass={secondaryButtonClass}
        downloadAriaLabel="Download invoice"
        closeAriaLabel="Close fullscreen invoice"
        onDownload={() => undefined}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /close fullscreen invoice/i }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
