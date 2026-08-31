import { describe, expect, it } from "vitest";
import {
  UserAlreadyExistsError,
  isUserAlreadyExistsError,
} from "./user-already-exists.js";

describe("isUserAlreadyExistsError", () => {
  it("returns true for UserAlreadyExistsError", () => {
    expect(isUserAlreadyExistsError(new UserAlreadyExistsError())).toBe(true);
  });

  it("returns true for a Postgres unique violation on users.email", () => {
    expect(
      isUserAlreadyExistsError({ code: "23505", constraint: "users_email_key" }),
    ).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isUserAlreadyExistsError(new Error("nope"))).toBe(false);
    expect(
      isUserAlreadyExistsError({ code: "23505", constraint: "other_constraint" }),
    ).toBe(false);
  });
});
