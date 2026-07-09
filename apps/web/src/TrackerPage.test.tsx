import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "./i18n/i18n.js";
import TrackerPage from "./TrackerPage.js";
import { createMatchMedia } from "./test/match-media.js";
import { MockEventSource, resetMockEventSources } from "./test/mock-event-source.js";
import { renderWithRunningTimer } from "./test/render-with-running-timer.js";
import { resetWorkspaceEventsConnectionForTests } from "./workspace-events-connection.js";
import { localDatetimeValue } from "./tracker/localDatetimeValue.js";

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
};

const afternoonEntry = {
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

const lastMonthEntry = {
  id: "e0000000-0000-4000-8000-000000000003",
  projectId: null,
  startedAt: "2026-06-25T10:00:00.000Z",
  endedAt: "2026-06-25T11:00:00.000Z",
  description: "Last month work",
  tags: [],
  billable: true,
  amount: 60,
  billableComplete: true,
  isRunning: false,
  durationMinutes: 60,
  invoiced: false,
};

function createFetchMock(
  entries: typeof morningEntry[],
  running: typeof morningEntry | null = null,
  limit = 50,
) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/auth/me") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ calendarTimezone: "UTC" }),
      });
    }
    if (url === `/api/time-entries?limit=${limit}`) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ entries }),
      });
    }
    if (url === "/api/time-entries/running") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ entry: running }),
      });
    }
    if (url === "/api/projects") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ projects: [] }),
      });
    }
    if (url === "/api/clients") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ clients: [] }),
      });
    }
    if (init?.method === "DELETE") {
      return Promise.resolve({ ok: true, status: 204 });
    }
    if (init?.method === "PATCH") {
      return Promise.resolve({
        ok: true,
        json: async () => morningEntry,
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

describe("TrackerPage", () => {
  beforeEach(async () => {
    localStorage.clear();
    resetMockEventSources();
    resetWorkspaceEventsConnectionForTests();
    await i18n.changeLanguage("en");
  });

  function renderTrackerPage() {
    return renderWithRunningTimer(<TrackerPage />);
  }

  it("refetches entries when timer-changed is received", async () => {
    let runningFetches = 0;
    let entryFetches = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ calendarTimezone: "UTC" }),
        });
      }
      if (url === "/api/time-entries?limit=50") {
        entryFetches += 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({ entries: [] }),
        });
      }
      if (url === "/api/time-entries/running") {
        runningFetches += 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({ entry: null }),
        });
      }
      if (url === "/api/projects") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ projects: [] }),
        });
      }
      if (url === "/api/clients") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ clients: [] }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTrackerPage();

    await waitFor(() => {
      expect(runningFetches).toBeGreaterThanOrEqual(1);
      expect(entryFetches).toBeGreaterThanOrEqual(1);
    });

    const entriesBefore = entryFetches;

    MockEventSource.instances[0]?.emit("timer-changed");

    await waitFor(() => {
      expect(entryFetches).toBeGreaterThan(entriesBefore);
    });
  });

  it("renders a unified sticky timer bar with start control when idle", async () => {
    vi.stubGlobal("fetch", createFetchMock([]));

    renderTrackerPage();

    await waitFor(() => {
      const bar = screen.getByRole("region", { name: /timer bar/i });
      expect(bar.className).toMatch(/sticky/);
      expect(screen.getByRole("button", { name: /start timer/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /stop timer/i })).not.toBeInTheDocument();
    });
  });

  it("renders the page title from the message catalog", async () => {
    vi.stubGlobal("fetch", createFetchMock([]));

    renderTrackerPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Tracker" })).toBeInTheDocument();
    });
  });

  it("renders the German page title when the active locale is de", async () => {
    await i18n.changeLanguage("de");
    vi.stubGlobal("fetch", createFetchMock([]));

    renderTrackerPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Tracker" })).toBeInTheDocument();
    });
  });

  it("loads tracker entries using the default limit", async () => {
    const fetchMock = createFetchMock([morningEntry]);
    vi.stubGlobal("fetch", fetchMock);

    renderTrackerPage();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/time-entries?limit=50");
    });
  });

  it("groups entries by month and day", async () => {
    vi.stubGlobal("fetch", createFetchMock([morningEntry, lastMonthEntry]));

    renderTrackerPage();

    await waitFor(() => {
      expect(screen.getByText("This month")).toBeInTheDocument();
      expect(screen.getByText("Last month")).toBeInTheDocument();
      expect(screen.getByText("Thu, Jul 2")).toBeInTheDocument();
      expect(screen.getByText("Thu, Jun 25")).toBeInTheDocument();
    });
  });

  it("reloads entries when the limit changes", async () => {
    const fetchMock = createFetchMock([morningEntry], null, 50);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/time-entries?limit=100") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ entries: [morningEntry] }),
        });
      }
      return createFetchMock([morningEntry], null, 50)(url, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTrackerPage();

    await waitFor(() => {
      expect(screen.getByText("Morning work")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/show entries/i), {
      target: { value: "100" },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/time-entries?limit=100");
    });
  });

  it("keeps a typed running-timer description when the project changes", async () => {
    const runningEntry = {
      id: "e0000000-0000-4000-8000-000000000099",
      projectId: null,
      startedAt: "2026-07-02T08:00:00.000Z",
      endedAt: null,
      description: null,
      tags: [],
      billable: true,
      amount: null,
      billableComplete: false,
      isRunning: true,
      durationMinutes: 5,
      invoiced: false,
    };
    const project = {
      id: "p0000000-0000-4000-8000-000000000001",
      clientId: "c0000000-0000-4000-8000-000000000001",
      name: "Acme Project",
      color: null,
    };

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ calendarTimezone: "UTC" }),
        });
      }
      if (url === "/api/time-entries?limit=50") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ entries: [runningEntry] }),
        });
      }
      if (url === "/api/time-entries/running") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ entry: runningEntry }),
        });
      }
      if (url === "/api/projects") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ projects: [project] }),
        });
      }
      if (url === "/api/clients") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            clients: [
              {
                id: project.clientId,
                name: "Acme Client",
                defaultRate: 60,
                legalName: null,
                addressLine1: null,
                addressLine2: null,
                invoicePrefix: null,
              },
            ],
          }),
        });
      }
      if (
        url === `/api/time-entries/${runningEntry.id}` &&
        init?.method === "PATCH"
      ) {
        const body = JSON.parse(init.body as string) as {
          description?: string | null;
          projectId?: string | null;
        };
        const updated = {
          ...runningEntry,
          description: body.description ?? runningEntry.description,
          projectId: body.projectId ?? runningEntry.projectId,
        };
        return Promise.resolve({
          ok: true,
          json: async () => updated,
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTrackerPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stop timer/i })).toBeInTheDocument();
    });

    const descriptionInput = screen.getByLabelText(/^description$/i);
    fireEvent.change(descriptionInput, { target: { value: "In progress work" } });

    fireEvent.change(screen.getByLabelText(/project \(optional\)/i), {
      target: { value: project.id },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/time-entries/${runningEntry.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            projectId: project.id,
            description: "In progress work",
          }),
        }),
      );
    });

    expect(descriptionInput).toHaveValue("In progress work");
  });

  it("deletes the Time Entry chosen when the dialog opened, even if another row Delete is clicked", async () => {
    let listedEntries = [morningEntry, afternoonEntry];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ calendarTimezone: "UTC" }),
        });
      }
      if (url === "/api/time-entries?limit=50") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ entries: listedEntries }),
        });
      }
      if (url === "/api/time-entries/running") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ entry: null }),
        });
      }
      if (url === "/api/projects") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ projects: [] }),
        });
      }
      if (url === "/api/clients") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ clients: [] }),
        });
      }
      if (init?.method === "DELETE") {
        listedEntries = [morningEntry];
        return Promise.resolve({ ok: true, status: 204 });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTrackerPage();
    await waitFor(() => {
      expect(screen.getByText("Afternoon work")).toBeInTheDocument();
    });

    const listDeleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(listDeleteButtons[0]!);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.click(listDeleteButtons[1]!);
    fireEvent.click(screen.getByRole("button", { name: /^confirm delete$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/time-entries/${afternoonEntry.id}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("patches description inline on desktop without an Edit button", async () => {
    window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;
    const fetchMock = createFetchMock([morningEntry]);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === `/api/time-entries/${morningEntry.id}` &&
        init?.method === "PATCH"
      ) {
        const body = JSON.parse(init.body as string) as { description?: string };
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...morningEntry,
            description: body.description ?? morningEntry.description,
          }),
        });
      }
      return createFetchMock([morningEntry])(url, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTrackerPage();

    await waitFor(() => {
      expect(screen.getByText("Morning work")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /morning work/i }));
    const input = screen.getByDisplayValue("Morning work");
    fireEvent.change(input, { target: { value: "Revised work" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/time-entries/${morningEntry.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ description: "Revised work" }),
        }),
      );
      expect(screen.getByText("Revised work")).toBeInTheDocument();
    });
  });

  it("re-buckets an entry when its start date moves to another day", async () => {
    window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;
    const fetchMock = createFetchMock([morningEntry, lastMonthEntry]);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === `/api/time-entries/${morningEntry.id}` &&
        init?.method === "PATCH"
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...morningEntry,
            startedAt: "2026-06-25T08:00:00.000Z",
            endedAt: "2026-06-25T09:00:00.000Z",
          }),
        });
      }
      return createFetchMock([morningEntry, lastMonthEntry])(url, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTrackerPage();

    await waitFor(() => {
      expect(screen.getByText("This month")).toBeInTheDocument();
      expect(screen.getByText("Last month")).toBeInTheDocument();
      expect(screen.getByText("Thu, Jul 2")).toBeInTheDocument();
    });

    const morningRow = screen.getByText("Morning work").closest("li");
    expect(morningRow).not.toBeNull();
    fireEvent.click(within(morningRow!).getByRole("button", { name: /^start:/i }));
    const startInput = screen.getByLabelText(/^start$/i);
    fireEvent.change(startInput, { target: { value: "2026-06-25T08:00" } });
    fireEvent.blur(startInput);

    await waitFor(() => {
      const jun25Header = screen.getByText("Thu, Jun 25").closest("div");
      expect(jun25Header).not.toBeNull();
      expect(within(jun25Header!.parentElement!).getAllByText("Morning work").length).toBe(1);
      expect(screen.queryByText("Thu, Jul 2")).not.toBeInTheDocument();
      expect(screen.queryByText("This month")).not.toBeInTheDocument();
      expect(screen.getByText("Last month")).toBeInTheDocument();
    });
  });

  it("surfaces PATCH error messages from the API", async () => {
    window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;
    const fetchMock = createFetchMock([morningEntry]);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === `/api/time-entries/${morningEntry.id}` &&
        init?.method === "PATCH"
      ) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ error: "Invoiced Time Entry is read-only" }),
        });
      }
      return createFetchMock([morningEntry])(url, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTrackerPage();

    await waitFor(() => {
      expect(screen.getByText("Morning work")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /morning work/i }));
    const input = screen.getByDisplayValue("Morning work");
    fireEvent.change(input, { target: { value: "Blocked edit" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText("Invoiced Time Entry is read-only")).toBeInTheDocument();
    });
  });

  it("surfaces invalid range PATCH errors from the API", async () => {
    window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;
    const fetchMock = createFetchMock([morningEntry]);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === `/api/time-entries/${morningEntry.id}` &&
        init?.method === "PATCH"
      ) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: "endedAt must be after startedAt" }),
        });
      }
      return createFetchMock([morningEntry])(url, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTrackerPage();

    await waitFor(() => {
      expect(screen.getByText("Morning work")).toBeInTheDocument();
    });

    const morningRow = screen.getByText("Morning work").closest("li");
    fireEvent.click(within(morningRow!).getByRole("button", { name: /^end:/i }));
    const endInput = screen.getByLabelText(/^end$/i);
    fireEvent.change(endInput, { target: { value: "2026-07-02T07:00" } });
    fireEvent.blur(endInput);

    await waitFor(() => {
      expect(screen.getByText("endedAt must be after startedAt")).toBeInTheDocument();
    });
  });

  it("surfaces not found PATCH errors from the API", async () => {
    window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;
    const fetchMock = createFetchMock([morningEntry]);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === `/api/time-entries/${morningEntry.id}` &&
        init?.method === "PATCH"
      ) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: "Time Entry not found" }),
        });
      }
      return createFetchMock([morningEntry])(url, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTrackerPage();

    await waitFor(() => {
      expect(screen.getByText("Morning work")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /morning work/i }));
    const input = screen.getByDisplayValue("Morning work");
    fireEvent.change(input, { target: { value: "Missing entry" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText("Time Entry not found")).toBeInTheDocument();
    });
  });

  it("updates duration from the server after an inline end edit", async () => {
    window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;
    const fetchMock = createFetchMock([morningEntry]);
    const updatedEndedAt = "2026-07-02T12:00:00.000Z";
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url === `/api/time-entries/${morningEntry.id}` &&
        init?.method === "PATCH"
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ...morningEntry,
            endedAt: updatedEndedAt,
            durationMinutes: 240,
          }),
        });
      }
      return createFetchMock([morningEntry])(url, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTrackerPage();

    await waitFor(() => {
      expect(screen.getByText("Morning work")).toBeInTheDocument();
    });

    const morningRow = screen.getByText("Morning work").closest("li");
    fireEvent.click(within(morningRow!).getByRole("button", { name: /^end:/i }));
    const endInput = screen.getByLabelText(/^end$/i);
    fireEvent.change(endInput, {
      target: { value: localDatetimeValue(new Date(updatedEndedAt)) },
    });
    fireEvent.blur(endInput);

    await waitFor(() => {
      const row = screen.getByText("Morning work").closest("li");
      expect(within(row!).getByText("4 h")).toBeInTheDocument();
    });
  });
});
