import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import i18n from "./i18n/i18n.js";
import TrackerPage from "./TrackerPage.js";
import { renderWithRunningTimer } from "./test/render-with-running-timer.js";
import { mockDesktopViewport, mockMobileViewport } from "./test/viewport.js";

vi.mock("./today-date.js", () => ({
  todayDateInTimeZone: () => "2026-07-02",
}));

const morningEntry = {
  id: "e0000000-0000-4000-8000-000000000001",
  projectId: null,
  startedAt: "2026-07-02T08:00:00.000Z",
  endedAt: "2026-07-02T09:00:00.000Z",
  description: "Morning work",
  tags: [],
  billable: true,
  amount: 60,
  billableComplete: true,
  isRunning: false,
  durationMinutes: 60,
  invoiced: false,
  locked: false,
};

function createFetchMock(entries: unknown[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/auth/me") {
      return { ok: true, json: async () => ({ calendarTimezone: "UTC" }) };
    }
    if (url === "/api/time-entries/running") {
      return { ok: true, json: async () => ({ entry: null }) };
    }
    if (url === "/api/time-entries/unbilled-this-month") {
      return {
        ok: true,
        json: async () => ({
          from: "2026-07-01",
          to: "2026-07-31",
          totalAmount: 60,
          incompleteCount: 0,
        }),
      };
    }
    if (url.startsWith("/api/time-entries")) {
      return { ok: true, json: async () => ({ entries }) };
    }
    if (url === "/api/projects") {
      return { ok: true, json: async () => ({ projects: [] }) };
    }
    if (url === "/api/clients") {
      return { ok: true, json: async () => ({ clients: [] }) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

describe("TrackerPage Warm Den layout", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("uses a wide desktop container with the day timeline region below the timer bar", async () => {
    mockDesktopViewport();
    vi.stubGlobal("fetch", createFetchMock([morningEntry]));

    renderWithRunningTimer(<TrackerPage />);

    const main = await screen.findByRole("main");
    expect(main).toHaveAttribute("data-width", "wide");
    expect(main.className).toMatch(/max-w-6xl/);
    expect(main.className).not.toMatch(/max-w-3xl/);

    await waitFor(() => {
      expect(screen.getByText("Morning work")).toBeInTheDocument();
    });

    const timerBar = screen.getByRole("region", { name: /timer bar/i });
    const timeline = screen.getByRole("region", { name: /day timeline/i });
    expect(
      timerBar.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(timeline.querySelector("[data-day-ribbon]")).not.toBeNull();
  });

  it("keeps the wide width attribute on mobile without a day-timeline landmark", async () => {
    mockMobileViewport();
    vi.stubGlobal("fetch", createFetchMock([morningEntry]));

    renderWithRunningTimer(<TrackerPage />);

    await waitFor(() => {
      expect(screen.getByText("Morning work")).toBeInTheDocument();
    });

    expect(screen.getByRole("main")).toHaveAttribute("data-width", "wide");
    expect(screen.queryByRole("region", { name: /day timeline/i })).not.toBeInTheDocument();
  });
});
