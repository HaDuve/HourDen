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
});
