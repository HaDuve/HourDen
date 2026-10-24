import type { Client, Project, TimeEntry } from "@hourden/domain";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { RunningTimerProvider } from "../running-timer/RunningTimerProvider.js";
import { QuickLogHost } from "./QuickLogHost.js";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-24T15:30:00.000Z"));
});

const ondojo: Project = {
  id: "proj-ondojo",
  clientId: "client-bandao",
  name: "Ondojo",
  color: null,
};

const ondojoApi: Project = {
  id: "proj-ondojo-api",
  clientId: "client-bandao",
  name: "Ondojo API",
  color: null,
};

const coaching: Project = {
  id: "proj-coaching",
  clientId: "client-hannah",
  name: "Coaching",
  color: null,
};

const clients: Client[] = [
  {
    id: "client-bandao",
    name: "BANDAO",
    defaultRate: 100,
    legalName: null,
    addressLine1: null,
    addressLine2: null,
    invoicePrefix: null,
    invoiceNumberSeqBeforeYear: false,
    recipientEmail: null,
    emailGreetingName: null,
    invoiceEmailSubject: null,
    invoiceEmailBody: null,
  },
  {
    id: "client-hannah",
    name: "HANNAH",
    defaultRate: 80,
    legalName: null,
    addressLine1: null,
    addressLine2: null,
    invoicePrefix: null,
    invoiceNumberSeqBeforeYear: false,
    recipientEmail: null,
    emailGreetingName: null,
    invoiceEmailSubject: null,
    invoiceEmailBody: null,
  },
];

function runningEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "running-1",
    projectId: null,
    startedAt: "2026-10-24T10:00:00.000Z",
    endedAt: null,
    description: "Work",
    tags: [],
    billable: true,
    amount: null,
    billableComplete: false,
    isRunning: true,
    durationMinutes: 0,
    invoiced: false,
    locked: false,
    ...overrides,
  };
}

function mockFetch(options: {
  projects?: Project[];
  running?: TimeEntry | null;
  onPost?: (url: string, body: unknown) => void;
} = {}) {
  const projects = options.projects ?? [ondojo, coaching];
  let running = options.running ?? null;

  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/auth/me") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ calendarTimezone: "UTC" }),
      });
    }
    if (url === "/api/projects") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ projects }),
      });
    }
    if (url === "/api/clients") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ clients }),
      });
    }
    if (url === "/api/time-entries/running") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ entry: running }),
      });
    }
    if (url === "/api/time-entries" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as unknown;
      options.onPost?.(url, body);
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ id: "entry-1" }),
      });
    }
    if (url === "/api/time-entries/timer" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as unknown;
      options.onPost?.(url, body);
      running = runningEntry({
        description: (body as { description?: string }).description ?? null,
        projectId: (body as { projectId?: string | null }).projectId ?? null,
      });
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => running,
      });
    }
    if (url.includes("/stop") && init?.method === "POST") {
      options.onPost?.(url, {});
      running = null;
      return Promise.resolve({
        ok: true,
        json: async () => runningEntry({ endedAt: "2026-10-24T11:00:00.000Z", isRunning: false }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

function renderHost() {
  return render(
    <MemoryRouter>
      <RunningTimerProvider>
        <button type="button">Outside</button>
        <QuickLogHost />
      </RunningTimerProvider>
    </MemoryRouter>,
  );
}

function openQuickLog(meta = true) {
  fireEvent.keyDown(document, {
    key: "k",
    metaKey: meta,
    ctrlKey: !meta,
  });
}

afterEach(async () => {
  cleanup();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("QuickLogHost", () => {
  it("opens on ⌘K / Ctrl+K as a dialog and closes on Escape with focus return", async () => {
    vi.stubGlobal("fetch", mockFetch());
    renderHost();

    const outside = screen.getByRole("button", { name: /^outside$/i });
    outside.focus();
    expect(outside).toHaveFocus();

    openQuickLog(true);

    const dialog = await screen.findByRole("dialog", { name: /quick log/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText(/quick log command/i)).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /quick log/i })).not.toBeInTheDocument();
    });
    expect(outside).toHaveFocus();

    openQuickLog(false);
    expect(await screen.findByRole("dialog", { name: /quick log/i })).toBeInTheDocument();
  });

  it("shows live preview for the four core examples", async () => {
    vi.stubGlobal("fetch", mockFetch());
    renderHost();
    openQuickLog();

    const input = await screen.findByLabelText(/quick log command/i);

    fireEvent.change(input, {
      target: { value: "2h ondojo api refactor yesterday" },
    });
    await waitFor(() => {
      expect(screen.getByText(/ondojo → bandao/i)).toBeInTheDocument();
      expect(screen.getByText(/api refactor/i)).toBeInTheDocument();
    });

    fireEvent.change(input, {
      target: { value: "9:00-11:30 coaching weekly call" },
    });
    await waitFor(() => {
      expect(screen.getByText(/09:00–11:30/i)).toBeInTheDocument();
      expect(screen.getByText(/coaching → hannah/i)).toBeInTheDocument();
      expect(screen.getByText(/weekly call/i)).toBeInTheDocument();
    });

    fireEvent.change(input, {
      target: { value: "start ondojo code review" },
    });
    await waitFor(() => {
      expect(screen.getByText(/start timer/i)).toBeInTheDocument();
      expect(screen.getByText(/code review/i)).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: "stop" } });
    await waitFor(() => {
      expect(screen.getByText(/stop the running timer/i)).toBeInTheDocument();
    });
  });

  it("shows what is missing for unparseable input", async () => {
    vi.stubGlobal("fetch", mockFetch());
    renderHost();
    openQuickLog();

    const input = await screen.findByLabelText(/quick log command/i);
    fireEvent.change(input, { target: { value: "api refactor" } });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/missing/i);
      expect(screen.getByRole("status")).toHaveTextContent(/duration or time range/i);
    });
  });

  it("offers an arrow-navigable pick list for ambiguous projects", async () => {
    vi.stubGlobal("fetch", mockFetch({ projects: [ondojo, ondojoApi, coaching] }));
    renderHost();
    openQuickLog();

    const input = await screen.findByLabelText(/quick log command/i);
    fireEvent.change(input, { target: { value: "1h ondojo work" } });

    const listbox = await screen.findByRole("listbox", { name: /matching projects/i });
    expect(within(listbox).getByRole("option", { name: /ondojo api/i })).toBeInTheDocument();
    expect(within(listbox).getAllByRole("option")).toHaveLength(2);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(within(listbox).getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(within(listbox).getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
  });

  it("commits a manual entry on Enter", async () => {
    const onPost = vi.fn();
    vi.stubGlobal("fetch", mockFetch({ onPost }));
    renderHost();
    openQuickLog();

    const input = await screen.findByLabelText(/quick log command/i);
    fireEvent.change(input, {
      target: { value: "9:00-11:30 coaching weekly call" },
    });

    await waitFor(() => {
      expect(screen.getByText(/press enter to confirm/i)).toBeInTheDocument();
    });

    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(onPost).toHaveBeenCalledWith(
        "/api/time-entries",
        expect.objectContaining({
          description: "weekly call",
          projectId: "proj-coaching",
          startedAt: "2026-10-24T09:00:00.000Z",
          endedAt: "2026-10-24T11:30:00.000Z",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /quick log/i })).not.toBeInTheDocument();
    });
  });

  it("starts and stops the Running Timer via Quick Log", async () => {
    const onPost = vi.fn();
    vi.stubGlobal("fetch", mockFetch({ onPost }));
    renderHost();

    openQuickLog();
    let input = await screen.findByLabelText(/quick log command/i);
    fireEvent.change(input, { target: { value: "start ondojo code review" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(onPost).toHaveBeenCalledWith(
        "/api/time-entries/timer",
        expect.objectContaining({
          description: "code review",
          projectId: "proj-ondojo",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Re-open with a running timer already known to the provider
    vi.stubGlobal(
      "fetch",
      mockFetch({
        running: runningEntry({
          description: "code review",
          projectId: "proj-ondojo",
        }),
        onPost,
      }),
    );

    // Remount so provider picks up running timer from fetch
    cleanup();
    renderHost();
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });

    openQuickLog();
    input = await screen.findByLabelText(/quick log command/i);
    fireEvent.change(input, { target: { value: "stop" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(onPost).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/time-entries\/running-1\/stop$/),
        {},
      );
    });
  });
});
