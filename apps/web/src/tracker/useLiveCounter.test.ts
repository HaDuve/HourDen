import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLiveCounter } from "./useLiveCounter.js";

describe("useLiveCounter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows 0:00:00 when no timer is running", () => {
    const { result } = renderHook(() => useLiveCounter(null));
    expect(result.current.text).toBe("0:00:00");
    expect(result.current.elapsedSeconds).toBe(0);
    expect(result.current.now).toEqual(new Date("2026-07-02T08:00:00.000Z"));
  });

  it("advances every second from the running timer startedAt", () => {
    const startedAt = "2026-07-02T08:00:00.000Z";
    const { result } = renderHook(() => useLiveCounter(startedAt));

    expect(result.current.text).toBe("0:00:00");
    expect(result.current.elapsedSeconds).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.text).toBe("0:00:01");
    expect(result.current.elapsedSeconds).toBe(1);

    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(result.current.text).toBe("0:01:00");
    expect(result.current.elapsedSeconds).toBe(60);
  });
});

