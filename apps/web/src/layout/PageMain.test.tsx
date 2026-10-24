import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageMain } from "./PageMain.js";
import { mockDesktopViewport, mockMobileViewport } from "../test/viewport.js";

describe("PageMain", () => {
  it("uses compact layout on mobile viewport", () => {
    mockMobileViewport();
    render(<PageMain>content</PageMain>);
    expect(screen.getByRole("main")).toHaveAttribute("data-layout", "mobile");
  });

  it("uses desktop layout on wide viewport", () => {
    mockDesktopViewport();
    render(<PageMain>content</PageMain>);
    expect(screen.getByRole("main")).toHaveAttribute("data-layout", "desktop");
  });

  it("keeps the readable column by default on desktop", () => {
    mockDesktopViewport();
    render(<PageMain>content</PageMain>);
    expect(screen.getByRole("main").className).toMatch(/max-w-3xl/);
    expect(screen.getByRole("main").className).not.toMatch(/max-w-6xl/);
  });

  it("uses a wide container on desktop when width is wide", () => {
    mockDesktopViewport();
    render(<PageMain width="wide">content</PageMain>);
    expect(screen.getByRole("main").className).toMatch(/max-w-6xl/);
    expect(screen.getByRole("main").className).not.toMatch(/max-w-3xl/);
  });

  it("keeps mobile width unconstrained by the wide desktop max", () => {
    mockMobileViewport();
    render(<PageMain width="wide">content</PageMain>);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("data-layout", "mobile");
    expect(main.className).toMatch(/max-w-6xl/);
  });
});
