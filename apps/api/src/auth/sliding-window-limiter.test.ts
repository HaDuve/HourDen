import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSlidingWindowLimiter } from "./sliding-window-limiter.js";

describe("createSlidingWindowLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the configured limit within the window", () => {
    const limiter = createSlidingWindowLimiter({
      limit: 2,
      windowMs: 60_000,
    });

    expect(limiter.tryConsume("ip:1")).toBe(true);
    expect(limiter.tryConsume("ip:1")).toBe(true);
    expect(limiter.tryConsume("ip:1")).toBe(false);
  });

  it("tracks keys independently", () => {
    const limiter = createSlidingWindowLimiter({
      limit: 1,
      windowMs: 60_000,
    });

    expect(limiter.tryConsume("ip:1")).toBe(true);
    expect(limiter.tryConsume("ip:2")).toBe(true);
    expect(limiter.tryConsume("ip:1")).toBe(false);
  });

  it("expires entries after the window elapses", () => {
    const limiter = createSlidingWindowLimiter({
      limit: 1,
      windowMs: 60_000,
    });

    expect(limiter.tryConsume("ip:1")).toBe(true);
    expect(limiter.tryConsume("ip:1")).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(limiter.tryConsume("ip:1")).toBe(true);
  });
});
