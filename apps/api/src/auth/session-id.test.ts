import { describe, expect, it } from "vitest";
import { isValidSessionId } from "./session-id.js";

describe("isValidSessionId", () => {
  it("accepts a UUID v4 session id", () => {
    expect(isValidSessionId("a0000000-0000-4000-8000-000000000001")).toBe(true);
  });

  it("rejects malformed session ids", () => {
    expect(isValidSessionId("not-a-real-session-id")).toBe(false);
    expect(isValidSessionId("")).toBe(false);
  });
});
