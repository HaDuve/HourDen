import { describe, expect, it } from "vitest";
import { healthPayload } from "./health.js";

describe("healthPayload", () => {
  it("returns ok without workspace info", () => {
    expect(healthPayload()).toEqual({ ok: true });
  });
});
