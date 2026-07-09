import { describe, expect, it } from "vitest";
import { formatAbbreviatedElapsed } from "./format.js";

describe("formatAbbreviatedElapsed", () => {
  it("formats seconds below one minute", () => {
    expect(formatAbbreviatedElapsed(6, "en")).toBe("6 sec");
    expect(formatAbbreviatedElapsed(6, "de")).toBe("6 Sek.");
  });

  it("formats whole minutes below one hour", () => {
    expect(formatAbbreviatedElapsed(60, "en")).toBe("1 min");
    expect(formatAbbreviatedElapsed(3599, "de")).toBe("59 Min.");
  });

  it("formats hours with optional remaining minutes", () => {
    expect(formatAbbreviatedElapsed(3600, "en")).toBe("1 h");
    expect(formatAbbreviatedElapsed(3660, "en")).toBe("1 h 1 min");
    expect(formatAbbreviatedElapsed(3660, "de")).toBe("1 Std. 1 Min.");
  });
});
