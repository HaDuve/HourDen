import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "../i18n/i18n.js";
import { LocaleProvider } from "../LocaleProvider.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";

describe("LanguageSwitcher", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("switches to German, persists via PATCH, and updates i18n", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ locale: "de" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LocaleProvider userLocale="en">
        <LanguageSwitcher />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("group", { name: /language/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("radio", { name: /^deutsch$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/locale",
        expect.objectContaining({
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: "de" }),
        }),
      );
      expect(localStorage.getItem("hourden.locale")).toBe("de");
      expect(i18n.language).toBe("de");
    });
  });

  it("shows a catalog error when saving the locale fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LocaleProvider userLocale="en">
        <LanguageSwitcher />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("group", { name: /language/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("radio", { name: /^deutsch$/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not save language preference/i)).toBeInTheDocument();
    });
    expect(i18n.language).toBe("en");
  });
});
