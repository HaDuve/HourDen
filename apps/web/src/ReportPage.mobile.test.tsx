import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import ReportPage from "./ReportPage.js";
import { mockMobileViewport } from "./test/viewport.js";

function reportWithLinesFetchMock() {
  return vi.fn().mockImplementation((url: string) => {
    if (url.startsWith("/api/reports?")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          from: "2026-06-01",
          to: "2026-06-30",
          clients: [
            {
              clientName: "Bandao",
              totalDurationMinutes: 60,
              totalAmount: 60,
              lines: [
                {
                  date: "2026-06-15",
                  description: "Consulting",
                  durationMinutes: 60,
                  amount: 60,
                },
              ],
            },
          ],
        }),
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

describe("ReportPage mobile layout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders report lines as label-value cards on mobile", async () => {
    mockMobileViewport();
    vi.stubGlobal("fetch", reportWithLinesFetchMock());

    render(<ReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Consulting")).toBeInTheDocument();
    });

    expect(screen.getByTestId("report-line-card")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("renders duration and amount with tabular numeric styling on mobile cards", async () => {
    mockMobileViewport();
    vi.stubGlobal("fetch", reportWithLinesFetchMock());

    render(<ReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Consulting")).toBeInTheDocument();
    });

    const card = screen.getByTestId("report-line-card");
    const durationValue = within(card).getByText("1:00");
    const amountValue = within(card).getByText(/€60\.00/);
    expect(durationValue).toHaveClass("tabular-nums", "font-mono", "text-right");
    expect(amountValue).toHaveClass("tabular-nums", "font-mono", "text-right");
  });
});
