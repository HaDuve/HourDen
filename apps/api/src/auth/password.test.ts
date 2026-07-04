import { describe, expect, it } from "vitest";
import { validatePassword } from "./password.js";

describe("validatePassword", () => {
  it("accepts a password with upper, lower, and digit (min 8 chars)", () => {
    expect(validatePassword("TestPass1")).toEqual({ ok: true });
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(validatePassword("Te1")).toEqual({
      ok: false,
      error: "Password must be at least 8 characters",
    });
  });

  it("rejects passwords without an uppercase letter", () => {
    expect(validatePassword("testpass1")).toEqual({
      ok: false,
      error: "Password must include an uppercase letter",
    });
  });

  it("rejects passwords without a lowercase letter", () => {
    expect(validatePassword("TESTPASS1")).toEqual({
      ok: false,
      error: "Password must include a lowercase letter",
    });
  });

  it("rejects passwords without a digit", () => {
    expect(validatePassword("TestPass")).toEqual({
      ok: false,
      error: "Password must include a digit",
    });
  });
});
