import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "../i18n/i18n.js";
import TrackerPage from "../TrackerPage.js";

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

class MockEventSource {
  close() {}
  addEventListener() {}
}

function createFetchMock() {
  return vi.fn((url: string) => {
    if (url === "/api/auth/me") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ calendarTimezone: "UTC" }),
      });
    }
    if (url === "/api/time-entries?limit=50") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ entries: [morningEntry] }),
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
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

describe("TrackerPage entry list styling", () => {
  it("right-aligns entry durations with tabular-nums", async () => {
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("fetch", createFetchMock());
    await i18n.changeLanguage("en");

    render(<TrackerPage />);

    await screen.findByText("Morning work");
    const row = screen.getByText("Morning work").closest("li");
    expect(row).not.toBeNull();

    const duration = row!.querySelector(".tabular-nums");
    expect(duration).not.toBeNull();
    expect(duration?.textContent).toMatch(/1 h/);
  });
});
