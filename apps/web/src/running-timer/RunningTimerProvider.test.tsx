import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockEventSource } from "../test/mock-event-source.js";
import { RunningTimerProvider } from "./RunningTimerProvider.js";
import { useRunningTimer } from "./RunningTimerContext.js";
import { resetWorkspaceEventsConnectionForTests } from "../workspace-events-connection.js";

describe("RunningTimerProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    MockEventSource.instances = [];
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({ status: 200 });
      }
      if (url === "/api/time-entries/running") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            entry: {
              id: "e0000000-0000-4000-8000-000000000099",
              projectId: null,
              startedAt: "2026-07-02T08:00:00.000Z",
              endedAt: null,
              description: null,
              tags: [],
              billable: true,
              amount: 0,
              billableComplete: false,
              isRunning: true,
              durationMinutes: 0,
              invoiced: false,
            },
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    resetWorkspaceEventsConnectionForTests();
    vi.unstubAllGlobals();
  });

  it("loads the running timer on mount", async () => {
    const { result } = renderHook(() => useRunningTimer(), {
      wrapper: RunningTimerProvider,
    });

    await waitFor(() => {
      expect(result.current.running?.id).toBe("e0000000-0000-4000-8000-000000000099");
      expect(result.current.startedAt).toBe("2026-07-02T08:00:00.000Z");
    });
  });

  it("refetches the running timer when timer-changed is received", async () => {
    const { result } = renderHook(() => useRunningTimer(), {
      wrapper: RunningTimerProvider,
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/time-entries/running");
    });

    const callsBefore = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/time-entries/running",
    ).length;

    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({ status: 200 });
      }
      if (url === "/api/time-entries/running") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ entry: null }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    act(() => {
      MockEventSource.instances[0]?.emit("timer-changed");
    });

    await waitFor(() => {
      const callsAfter = fetchMock.mock.calls.filter(
        ([url]) => url === "/api/time-entries/running",
      ).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
      expect(result.current.running).toBeNull();
    });
  });
});
