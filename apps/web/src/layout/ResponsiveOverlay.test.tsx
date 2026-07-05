import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
