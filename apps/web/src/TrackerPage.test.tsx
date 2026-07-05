import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "./i18n/i18n.js";
import TrackerPage from "./TrackerPage.js";
import { MockEventSource, resetMockEventSources } from "./test/mock-event-source.js";

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

const lastWeekEntry = {
  id: "e0000000-0000-4000-8000-000000000003",
  projectId: null,
  startedAt: "2026-06-25T10:00:00.000Z",
  endedAt: "2026-06-25T11:00:00.000Z",
  description: "Last week work",
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
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

describe("TrackerPage", () => {
  beforeEach(async () => {
    localStorage.clear();
    resetMockEventSources();
    await i18n.changeLanguage("en");
  });

  it("refetches running timer and entries when timer-changed is received", async () => {
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

    render(<TrackerPage />);

    await waitFor(() => {
      expect(runningFetches).toBeGreaterThanOrEqual(1);
      expect(entryFetches).toBeGreaterThanOrEqual(1);
    });

    const runningBefore = runningFetches;
    const entriesBefore = entryFetches;

    MockEventSource.instances[0]?.emit("timer-changed");

    await waitFor(() => {
      expect(runningFetches).toBeGreaterThan(runningBefore);
      expect(entryFetches).toBeGreaterThan(entriesBefore);
    });
  });

  it("renders a unified sticky timer bar with start control when idle", async () => {
    vi.stubGlobal("fetch", createFetchMock([]));

    render(<TrackerPage />);

    await waitFor(() => {
      const bar = screen.getByRole("region", { name: /timer bar/i });
      expect(bar.className).toMatch(/sticky/);
      expect(screen.getByRole("button", { name: /start timer/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /stop timer/i })).not.toBeInTheDocument();
    });
  });

  it("renders the page title from the message catalog", async () => {
    vi.stubGlobal("fetch", createFetchMock([]));

    render(<TrackerPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Tracker" })).toBeInTheDocument();
    });
  });

  it("renders the German page title when the active locale is de", async () => {
    await i18n.changeLanguage("de");
    vi.stubGlobal("fetch", createFetchMock([]));

    render(<TrackerPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Tracker" })).toBeInTheDocument();
    });
  });

  it("loads tracker entries using the default limit", async () => {
    const fetchMock = createFetchMock([morningEntry]);
    vi.stubGlobal("fetch", fetchMock);

    render(<TrackerPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/time-entries?limit=50");
    });
  });

  it("groups entries by week and day", async () => {
    vi.stubGlobal("fetch", createFetchMock([morningEntry, lastWeekEntry]));

    render(<TrackerPage />);

    await waitFor(() => {
      expect(screen.getByText("This week")).toBeInTheDocument();
      expect(screen.getByText("Last week")).toBeInTheDocument();
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

    render(<TrackerPage />);

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

    render(<TrackerPage />);

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

    render(<TrackerPage />);
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
});
