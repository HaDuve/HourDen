import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ResponsiveOverlay } from "./ResponsiveOverlay.js";
import { mockDesktopViewport, mockMobileViewport } from "../test/viewport.js";

describe("ResponsiveOverlay", () => {
  it("presents as a bottom sheet on mobile", () => {
    mockMobileViewport();
    render(
      <ResponsiveOverlay ariaLabel="Edit client">
        <p>Form</p>
      </ResponsiveOverlay>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-presentation",
      "sheet",
    );
  });

  it("presents as a centered modal on desktop", () => {
    mockDesktopViewport();
    render(
      <ResponsiveOverlay ariaLabel="Edit client">
        <p>Form</p>
      </ResponsiveOverlay>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-presentation",
      "modal",
    );
  });

  it("renders overlay panel with semantic surface tokens", () => {
    mockDesktopViewport();
    render(
      <ResponsiveOverlay ariaLabel="Edit client">
        <p>Form</p>
      </ResponsiveOverlay>,
    );
    const panel = screen.getByText("Form").parentElement;
    expect(panel).toHaveClass("bg-surface", "border-divider");
  });

  it("stacks above the mobile bottom navigation", () => {
    mockMobileViewport();
    render(
      <ResponsiveOverlay ariaLabel="Edit client">
        <p>Form</p>
      </ResponsiveOverlay>,
    );
    expect(screen.getByRole("dialog").className).toMatch(/\bz-40\b/);
  });

  it("moves focus to the first focusable control when opened", () => {
    mockDesktopViewport();
    render(
      <>
        <button type="button">Outside</button>
        <ResponsiveOverlay ariaLabel="Edit client" onClose={vi.fn()}>
          <h2>Edit client</h2>
          <button type="button">Cancel</button>
          <button type="button">Save</button>
        </ResponsiveOverlay>
      </>,
    );

    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
  });

  it("closes on Escape and returns focus to the opener", () => {
    mockDesktopViewport();
    const onClose = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {open ? (
            <ResponsiveOverlay
              ariaLabel="Confirm delete"
              onClose={() => {
                onClose();
                setOpen(false);
              }}
            >
              <h2>Delete?</h2>
              <button type="button">Cancel</button>
            </ResponsiveOverlay>
          ) : null}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: /^open$/i });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps Tab and Shift+Tab inside the overlay", () => {
    mockDesktopViewport();
    render(
      <>
        <button type="button">Outside</button>
        <ResponsiveOverlay ariaLabel="Edit client" onClose={vi.fn()}>
          <button type="button">First</button>
          <button type="button">Last</button>
        </ResponsiveOverlay>
      </>,
    );

    const first = screen.getByRole("button", { name: /^first$/i });
    const last = screen.getByRole("button", { name: /^last$/i });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
  });
});
