import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceEvents } from "./useWorkspaceEvents.js";

type Listener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  withCredentials: boolean;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Set<Listener>>();
  closed = false;

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  close() {
    this.closed = true;
  }

  emit(type: string) {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }
    const event = new MessageEvent(type, { data: "" });
    for (const listener of listeners) {
      listener(event);
    }
  }

  triggerError() {
    this.onerror?.();
  }
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useWorkspaceEvents", () => {
  const fetchMock = vi.fn();
  const replaceMock = vi.fn();

  beforeEach(() => {
    MockEventSource.instances = [];
    fetchMock.mockReset();
    replaceMock.mockReset();
    fetchMock.mockResolvedValue({ status: 200 });
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.stubGlobal("location", { replace: replaceMock });
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn) => {
      queueMicrotask(() => {
        if (typeof fn === "function") {
          fn();
        }
      });
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reconnects after the stream drops when the session is still valid", async () => {
    const onTimerChanged = vi.fn();

    renderHook(() =>
      useWorkspaceEvents({
        "timer-changed": onTimerChanged,
      }),
    );

    await flushPromises();
    expect(MockEventSource.instances).toHaveLength(1);
    const first = MockEventSource.instances[0];

    act(() => {
      first.triggerError();
    });
    await flushPromises();

    expect(first.closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", {
      credentials: "include",
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects to login when the session is no longer valid", async () => {
    fetchMock.mockResolvedValue({ status: 401 });

    renderHook(() =>
      useWorkspaceEvents({
        "timer-changed": vi.fn(),
      }),
    );

    await flushPromises();
    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("redirects to login after the stream drops and the session expired", async () => {
    renderHook(() =>
      useWorkspaceEvents({
        "timer-changed": vi.fn(),
      }),
    );

    await flushPromises();
    const source = MockEventSource.instances[0];
    fetchMock.mockResolvedValue({ status: 401 });

    act(() => {
      source.triggerError();
    });
    await flushPromises();

    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(source.closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("reconnects when session check fails transiently after the stream drops", async () => {
    fetchMock
      .mockResolvedValueOnce({ status: 200 })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ status: 200 });

    renderHook(() =>
      useWorkspaceEvents({
        "timer-changed": vi.fn(),
      }),
    );

    await flushPromises();
    const first = MockEventSource.instances[0];

    act(() => {
      first.triggerError();
    });
    await flushPromises();

    expect(replaceMock).not.toHaveBeenCalled();
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("retries when the initial session check is transiently unavailable", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ status: 200 });

    renderHook(() =>
      useWorkspaceEvents({
        "timer-changed": vi.fn(),
      }),
    );

    await flushPromises();
    await flushPromises();

    expect(replaceMock).not.toHaveBeenCalled();
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("invokes the mapped handler when a workspace event arrives", async () => {
    const onTodayChanged = vi.fn();

    renderHook(() =>
      useWorkspaceEvents({
        "today-changed": onTodayChanged,
      }),
    );

    await flushPromises();
    const source = MockEventSource.instances[0];

    act(() => {
      source.emit("today-changed");
    });

    expect(onTodayChanged).toHaveBeenCalledTimes(1);
  });

  it("resets reconnect backoff after a successful connection", async () => {
    const delays: number[] = [];
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, delay) => {
      if (typeof delay === "number") {
        delays.push(delay);
      }
      queueMicrotask(() => {
        if (typeof fn === "function") {
          fn();
        }
      });
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    renderHook(() =>
      useWorkspaceEvents({
        "timer-changed": vi.fn(),
      }),
    );

    await flushPromises();
    const first = MockEventSource.instances[0];

    act(() => {
      first.triggerError();
    });
    await flushPromises();

    expect(delays[0]).toBe(1_000);
    expect(MockEventSource.instances).toHaveLength(2);

    const second = MockEventSource.instances[1];
    act(() => {
      second.triggerError();
    });
    await flushPromises();

    expect(delays[1]).toBe(1_000);
  });
});
