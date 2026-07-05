import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "./i18n/i18n.js";
import ReportPage from "./ReportPage.js";

function reportFetchMock() {
  return vi.fn().mockImplementation((url: string) => {
    if (url.startsWith("/api/reports?")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ from: "2026-06-01", to: "2026-06-30", clients: [] }),
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

describe("ReportPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a clear empty state when there is no billable time in the range", async () => {
    vi.stubGlobal("fetch", reportFetchMock());

    render(<ReportPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No billable time in this date range."),
      ).toBeInTheDocument();
    });
  });

  it("shows the German empty state when the active locale is de", async () => {
    await i18n.changeLanguage("de");
    vi.stubGlobal("fetch", reportFetchMock());

    render(<ReportPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Keine abrechenbare Zeit in diesem Zeitraum."),
      ).toBeInTheDocument();
    });
  });

  it("sets the date range to last month when the last month quick control is clicked", async () => {
    vi.stubGlobal("fetch", reportFetchMock());
    vi.setSystemTime(new Date(2026, 5, 18));

    render(<ReportPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^from$/i)).toHaveValue("2026-06-01");
    });

    fireEvent.click(screen.getByRole("button", { name: /^last month$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^from$/i)).toHaveValue("2026-05-01");
      expect(screen.getByLabelText(/^to$/i)).toHaveValue("2026-05-31");
    });
  });
});
