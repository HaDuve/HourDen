import { describe, expect, it } from "vitest";
import { elapsedSecondsSince, formatElapsedHMMSS } from "./elapsed.js";

describe("formatElapsedHMMSS", () => {
  it("formats zero as 0:00:00", () => {
    expect(formatElapsedHMMSS(0)).toBe("0:00:00");
  });

  it("formats hours, minutes, and seconds with zero padding", () => {
    expect(formatElapsedHMMSS(3661)).toBe("1:01:01");
  });
});

describe("elapsedSecondsSince", () => {
  it("returns whole seconds elapsed since an ISO start time", () => {
    const startedAt = "2026-07-02T08:00:00.000Z";
    const now = new Date("2026-07-02T08:05:30.500Z");
    expect(elapsedSecondsSince(startedAt, now)).toBe(330);
  });

  it("never returns negative elapsed time", () => {
    const startedAt = "2026-07-02T09:00:00.000Z";
    const now = new Date("2026-07-02T08:00:00.000Z");
    expect(elapsedSecondsSince(startedAt, now)).toBe(0);
  });
});
