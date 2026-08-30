import { describe, expect, it } from "vitest";
import {
  POST_ISSUE_PREPARE_EMAIL_BLINK_MS,
  shouldBlinkPrepareEmail,
} from "./post-issue-email-handoff.js";

describe("shouldBlinkPrepareEmail", () => {
  it("blinks when recipient email is present and motion is allowed", () => {
    expect(shouldBlinkPrepareEmail("billing@example.com", false)).toBe(true);
  });

  it("does not blink when recipient email is missing", () => {
    expect(shouldBlinkPrepareEmail(null, false)).toBe(false);
    expect(shouldBlinkPrepareEmail("", false)).toBe(false);
    expect(shouldBlinkPrepareEmail("   ", false)).toBe(false);
  });

  it("does not blink when prefers-reduced-motion is on", () => {
    expect(shouldBlinkPrepareEmail("billing@example.com", true)).toBe(false);
  });
});

describe("POST_ISSUE_PREPARE_EMAIL_BLINK_MS", () => {
  it("lasts about three seconds", () => {
    expect(POST_ISSUE_PREPARE_EMAIL_BLINK_MS).toBe(3000);
  });
});
