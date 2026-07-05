import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "./i18n/i18n.js";
import DashboardPage from "./DashboardPage.js";

const dashboardPayload = {
  from: "2026-06-01",
  to: "2026-06-30",
  totalDurationMinutes: 134,
  totalBillableAmount: 194,
  topProject: { name: "Ondojo", durationMinutes: 74 },
  topClient: { name: "Bandao", durationMinutes: 74 },
  dailyBuckets: [
    { date: "2026-06-18", durationMinutes: 74 },
    { date: "2026-06-19", durationMinutes: 60 },
  ],
};

function dashboardFetchMock() {
  return vi.fn().mockImplementation((url: string) => {
    if (url.startsWith("/api/dashboard?")) {
      return Promise.resolve({
        ok: true,
        json: async () => dashboardPayload,
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

describe("DashboardPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders KPI totals from the dashboard API", async () => {
    vi.stubGlobal("fetch", dashboardFetchMock());

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^dashboard$/i })).toBeInTheDocument();
    });

    expect(screen.getByText("2:14")).toBeInTheDocument();
    expect(screen.getByText("€194.00")).toBeInTheDocument();
    expect(screen.getByText("Ondojo")).toBeInTheDocument();
    expect(screen.getByText("Bandao")).toBeInTheDocument();
  });

  it("renders the daily time chart when the range has tracked time", async () => {
    vi.stubGlobal("fetch", dashboardFetchMock());

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^daily time$/i })).toBeInTheDocument();
    });
  });

  it("refetches when the last month quick control is clicked", async () => {
    const fetchMock = dashboardFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    vi.setSystemTime(new Date(2026, 5, 18));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^from$/i)).toHaveValue("2026-06-01");
    });

    fireEvent.click(screen.getByRole("button", { name: /^last month$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/dashboard?from=2026-05-01&to=2026-05-31",
      );
    });
  });
});
