import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TimeEntry } from "@hourden/domain";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import i18n from "./i18n/i18n.js";
import TodayPage from "./TodayPage.js";
import { MockEventSource, jsonResponse, stubWorkspaceEventsEnvironment } from "./test/mock-event-source.js";
import { resolveFetchUrl } from "./test/resolve-fetch-url.js";

vi.mock("./today-date.js", () => ({
  todayDateInTimeZone: () => "2026-07-02",
}));

const morningEntry: TimeEntry = {
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
};

const afternoonEntry: TimeEntry = {
  id: "e0000000-0000-4000-8000-000000000002",
  projectId: null,
  startedAt: "2026-07-02T13:00:00.000Z",
  endedAt: "2026-07-02T14:00:00.000Z",
  description: "Afternoon work",
  tags: [],
  billable: true,
  amount: 60,
  billableComplete: true,
  isRunning: false,
  durationMinutes: 60,
  invoiced: false,
};

const runningEntry: TimeEntry = {
  id: "e0000000-0000-4000-8000-000000000099",
  projectId: null,
  startedAt: "2026-07-02T09:59:30.000Z",
  endedAt: null,
  description: null,
  tags: [],
  billable: true,
  amount: null,
  billableComplete: false,
  isRunning: true,
  durationMinutes: 0,
  invoiced: false,
};

const remoteRunningEntry: TimeEntry = {
  ...runningEntry,
  id: "e0000000-0000-4000-8000-000000000088",
  description: "Started elsewhere",
};

function mockTodayLoad(
  entries: TimeEntry[],
  running: TimeEntry | null = null,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = resolveFetchUrl(input);

    if (url === "/api/auth/me") {
      return jsonResponse({ calendarTimezone: "UTC" });
    }
    if (url.startsWith("/api/time-entries?date=")) {
      return jsonResponse({ entries });
    }
    if (url === "/api/time-entries/running") {
      return jsonResponse({ entry: running });
    }
    if (url === "/api/projects") {
      return jsonResponse({ projects: [] });
    }
    if (init?.method === "DELETE") {
      return { ok: true, status: 204 };
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("TodayPage", () => {
  beforeEach(async () => {
    stubWorkspaceEventsEnvironment();
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("renders the page title from the message catalog", async () => {
    vi.stubGlobal("fetch", mockTodayLoad([]));

    render(<TodayPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    });
  });

  it("renders the German page title when the active locale is de", async () => {
    await i18n.changeLanguage("de");
    vi.stubGlobal("fetch", mockTodayLoad([]));

    render(<TodayPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Heute" })).toBeInTheDocument();
    });
  });

  it("deletes the Time Entry chosen when the dialog opened, even if another row Delete is clicked", async () => {
    const fetchMock = mockTodayLoad([morningEntry, afternoonEntry]);
    vi.stubGlobal("fetch", fetchMock);

    render(<TodayPage />);
    await waitFor(() => {
      expect(screen.getByText("Afternoon work")).toBeInTheDocument();
    });

    const listDeleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(listDeleteButtons[1]!);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.click(listDeleteButtons[0]!);
    fireEvent.click(screen.getByRole("button", { name: /^confirm delete$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/time-entries/${afternoonEntry.id}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("shows the live counter from startedAt on initial render", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T10:00:00.000Z"));
    vi.stubGlobal("fetch", mockTodayLoad([], runningEntry));

    render(<TodayPage />);
    await flushPromises();

    expect(screen.getByText(/Timer running — 30 sec/)).toBeInTheDocument();
  });

  it("refetches the running timer when timer-changed arrives over SSE", async () => {
    let runningFetches = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = resolveFetchUrl(input);

      if (url === "/api/time-entries/running") {
        runningFetches += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            entry: runningFetches === 1 ? runningEntry : remoteRunningEntry,
          }),
        };
      }

      return mockTodayLoad([], runningEntry)(input);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TodayPage />);
    await flushPromises();

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    act(() => {
      MockEventSource.instances[0]!.emit("timer-changed");
    });

    await waitFor(() => {
      expect(runningFetches).toBeGreaterThanOrEqual(2);
    });
  });

  it("refetches today's entries when today-changed arrives over SSE", async () => {
    let entryFetches = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = resolveFetchUrl(input);

      if (url.startsWith("/api/time-entries?date=")) {
        entryFetches += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            entries:
              entryFetches === 1
                ? [morningEntry]
                : [morningEntry, afternoonEntry],
          }),
        };
      }

      return mockTodayLoad([morningEntry])(input);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TodayPage />);
    await flushPromises();

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    act(() => {
      MockEventSource.instances[0]!.emit("today-changed");
    });

    await waitFor(() => {
      expect(screen.getByText("Afternoon work")).toBeInTheDocument();
    });
  });

  it("shows a notice when another device starts a timer and stops the current one", async () => {
    let runningFetches = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = resolveFetchUrl(input);

      if (url === "/api/time-entries/running") {
        runningFetches += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            entry: runningFetches === 1 ? runningEntry : remoteRunningEntry,
          }),
        };
      }

      return mockTodayLoad([], runningEntry)(input);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TodayPage />);
    await flushPromises();

    await waitFor(() => {
      expect(screen.getByText(/Timer running —/)).toBeInTheDocument();
    });

    act(() => {
      MockEventSource.instances[0]!.emit("timer-changed");
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Timer stopped — a new one was started on another device",
        ),
      ).toBeInTheDocument();
    });
  });

  it("does not show the remote-stop notice after stopping the timer locally", async () => {
    let runningFetches = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = resolveFetchUrl(input);

      if (url === `/api/time-entries/${runningEntry.id}/stop` && init?.method === "POST") {
        return jsonResponse({
          ...runningEntry,
          endedAt: "2026-07-02T10:05:00.000Z",
          isRunning: false,
          durationMinutes: 5,
        });
      }
      if (url === "/api/time-entries/running") {
        runningFetches += 1;
        return jsonResponse({
          entry: runningFetches === 1 ? runningEntry : null,
        });
      }

      return mockTodayLoad([], runningEntry)(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TodayPage />);
    await flushPromises();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^stop timer$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^stop timer$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^start timer$/i })).toBeInTheDocument();
    });

    act(() => {
      MockEventSource.instances[0]!.emit("timer-changed");
    });
    await flushPromises();

    expect(
      screen.queryByText(
        "Timer stopped — a new one was started on another device",
      ),
    ).not.toBeInTheDocument();
  });
});
