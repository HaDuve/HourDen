import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  clientBuckets: [
    { name: "Bandao", durationMinutes: 74, billableAmount: 74 },
    { name: "Acme", durationMinutes: 60, billableAmount: 120 },
  ],
  topActivities: [
    {
      description: "App Development",
      projectName: "Ondojo",
      clientName: "Bandao",
      durationMinutes: 66,
    },
    {
      description: "Homepage",
      projectName: "Website",
      clientName: "Acme",
      durationMinutes: 60,
    },
    {
      description: "Planning",
      projectName: "Ondojo",
      clientName: "Bandao",
      durationMinutes: 8,
    },
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

    const summary = screen.getByRole("region", { name: /^summary$/i });
    expect(within(summary).getByText("2:14")).toBeInTheDocument();
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

  it("renders the by-client donut with legend percentages and centered total", async () => {
    vi.stubGlobal("fetch", dashboardFetchMock());

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^by client$/i })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/^client time$/i)).toHaveTextContent("2:14");
    expect(screen.getByText(/bandao \(55%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/acme \(45%\)/i)).toBeInTheDocument();

    const bandaoLegend = screen.getByText(/bandao \(55%\)/i).closest("li");
    const acmeLegend = screen.getByText(/acme \(45%\)/i).closest("li");
    expect(bandaoLegend).toHaveTextContent("€74.00");
    expect(acmeLegend).toHaveTextContent("€120.00");
  });

  it("formats client billable amounts using the active locale", async () => {
    await i18n.changeLanguage("de");
    vi.stubGlobal("fetch", dashboardFetchMock());

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^nach kunde$/i })).toBeInTheDocument();
    });

    const bandaoLegend = screen.getByText(/bandao \(55%\)/i).closest("li");
    expect(bandaoLegend).toHaveTextContent("74,00");
    expect(bandaoLegend).toHaveTextContent("€");
  });

  it("omits billable amounts from the client legend when they are zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.startsWith("/api/dashboard?")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ...dashboardPayload,
              clientBuckets: [
                { name: "Bandao", durationMinutes: 74, billableAmount: 74 },
                { name: null, durationMinutes: 60, billableAmount: 0 },
              ],
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }),
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/unassigned \(45%\)/i)).toBeInTheDocument();
    });

    const unassignedLegend = screen.getByText(/unassigned \(45%\)/i).closest("li");
    expect(unassignedLegend).not.toHaveTextContent("€");
    expect(screen.getByText(/bandao \(55%\)/i).closest("li")).toHaveTextContent("€74.00");
  });

  it("labels unassigned client buckets and bases donut percentages on bucket totals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.startsWith("/api/dashboard?")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ...dashboardPayload,
              totalDurationMinutes: 150,
              clientBuckets: [
                { name: "Bandao", durationMinutes: 74, billableAmount: 74 },
                { name: "Acme", durationMinutes: 60, billableAmount: 120 },
                { name: null, durationMinutes: 16, billableAmount: 0 },
              ],
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }),
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/unassigned \(11%\)/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/bandao \(49%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/acme \(40%\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^client time$/i)).toHaveTextContent("2:30");
  });

  it("omits the project/client subtitle when an activity has no project", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.startsWith("/api/dashboard?")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ...dashboardPayload,
              topActivities: [
                {
                  description: "Internal admin",
                  projectName: null,
                  clientName: null,
                  durationMinutes: 60,
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      }),
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Internal admin")).toBeInTheDocument();
    });

    const list = screen.getByRole("list", { name: /^top activities$/i });
    const item = within(list).getByRole("listitem");
    expect(item).not.toHaveTextContent("·");
    expect(item).not.toHaveTextContent("null");
  });

  it("renders the ranked top-activities list with monospaced durations", async () => {
    vi.stubGlobal("fetch", dashboardFetchMock());

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^top activities$/i })).toBeInTheDocument();
    });

    const list = screen.getByRole("list", { name: /^top activities$/i });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("App Development");
    expect(items[0]).toHaveTextContent("Ondojo");
    expect(items[0]).toHaveTextContent("Bandao");
    expect(within(items[0]).getByText("1:06")).toHaveClass("font-mono");
    expect(items[1]).toHaveTextContent("Homepage");
    expect(within(items[2]).getByText("0:08")).toHaveClass("font-mono");
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
