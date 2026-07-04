import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  elapsedSecondsFromStartedAt,
  formatElapsedDuration,
  useLiveCounter,
} from "./useLiveCounter.js";

describe("elapsedSecondsFromStartedAt", () => {
  it("returns whole seconds elapsed since startedAt", () => {
    const startedAt = "2026-07-04T10:00:00.000Z";
    const now = new Date("2026-07-04T10:01:30.500Z").getTime();

    expect(elapsedSecondsFromStartedAt(startedAt, now)).toBe(90);
  });
});

describe("formatElapsedDuration", () => {
  it("shows seconds under one minute", () => {
    expect(formatElapsedDuration(45)).toBe("45 sec");
  });

  it("shows minutes and seconds under one hour", () => {
    expect(formatElapsedDuration(90)).toBe("1 min 30 sec");
  });

  it("shows hours, minutes, and seconds at one hour or more", () => {
    expect(formatElapsedDuration(3661)).toBe("1 h 1 min 1 sec");
  });
});

describe("useLiveCounter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when there is no running timer", () => {
    const { result } = renderHook(() => useLiveCounter(null));

    expect(result.current).toBeNull();
  });

  it("advances every second without refetching startedAt", () => {
    const startedAt = "2026-07-04T09:59:30.000Z";
    const { result } = renderHook(() => useLiveCounter(startedAt));

    expect(result.current).toBe("30 sec");

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe("31 sec");

    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe("1 min 0 sec");
  });
});
