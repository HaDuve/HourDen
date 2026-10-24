import { describe, expect, it } from "vitest";
import { RECORDING_DOT_COLOR } from "./constants.js";

describe("recording favicon chrome", () => {
  it("marks the Running Timer with ember, not red or green", () => {
    expect(RECORDING_DOT_COLOR.toLowerCase()).toBe("#f59e0b");
  });
});
