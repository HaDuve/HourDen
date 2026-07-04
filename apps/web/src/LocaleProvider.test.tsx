import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import i18n from "./i18n/i18n.js";
import { LocaleProvider } from "./LocaleProvider.js";

describe("LocaleProvider", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("applies the User Language, caches it, and renders children", async () => {
    vi.stubGlobal("navigator", { language: "en-US" });

    render(
      <LocaleProvider userLocale="de">
        <p>Ready</p>
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    expect(localStorage.getItem("hourden.locale")).toBe("de");
    expect(i18n.language).toBe("de");
  });

  it("prefers the User record over a cached localStorage value", async () => {
    localStorage.setItem("hourden.locale", "en");
    vi.stubGlobal("navigator", { language: "en-US" });

    render(
      <LocaleProvider userLocale="de">
        <p>Ready</p>
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    expect(localStorage.getItem("hourden.locale")).toBe("de");
    expect(i18n.language).toBe("de");
  });
});
