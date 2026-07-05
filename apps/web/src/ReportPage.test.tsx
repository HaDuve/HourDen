import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "./i18n/i18n.js";
import ReportPage from "./ReportPage.js";
import { mockDesktopViewport } from "./test/viewport.js";

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

  it("formats amounts and dates for German locale", async () => {
    await i18n.changeLanguage("de");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.startsWith("/api/reports?")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              from: "2026-06-01",
              to: "2026-06-30",
              clients: [
                {
                  clientId: "c1",
                  clientName: "Acme",
                  totalDurationMinutes: 60,
                  totalAmount: 1234.56,
                  lines: [
                    {
                      date: "2026-06-15",
                      description: "Work",
                      durationMinutes: 60,
                      amount: 1234.56,
                    },
                  ],
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }),
    );

    render(<ReportPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/1\.234,56/).length).toBeGreaterThan(0);
      expect(screen.getByText("15.06.2026")).toBeInTheDocument();
    });
  });

  it("renders line duration and amount with tabular numeric styling on desktop", async () => {
    mockDesktopViewport();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.startsWith("/api/reports?")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              from: "2026-06-01",
              to: "2026-06-30",
              clients: [
                {
                  clientId: "c1",
                  clientName: "Acme",
                  totalDurationMinutes: 90,
                  totalAmount: 150,
                  lines: [
                    {
                      date: "2026-06-15",
                      description: "Work",
                      durationMinutes: 90,
                      amount: 150,
                    },
                  ],
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }),
    );

    render(<ReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Work")).toBeInTheDocument();
    });

    const line = screen.getByText("Work").closest("li");
    expect(line).not.toBeNull();
    const amountNode = within(line as HTMLElement).getByText(/€150\.00/);
    expect(amountNode).toHaveClass("tabular-nums", "font-mono");
  });
});
