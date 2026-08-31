import { describe, expect, it } from "vitest";
import { resolveAuthErrorMessage } from "./read-auth-error.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("resolveAuthErrorMessage", () => {
  it("maps wrong login credentials to the generic login failure copy", async () => {
    const message = await resolveAuthErrorMessage(
      "login",
      jsonResponse(401, { error: "Invalid email or password" }),
    );
    expect(message).toBe("login.invalidCredentials");
  });

  it("maps duplicate signup email to the generic signup failure copy", async () => {
    const message = await resolveAuthErrorMessage(
      "signup",
      jsonResponse(409, { error: "Unable to register" }),
    );
    expect(message).toBe("signup.failed");
  });

  it("passes through password validation errors from the API", async () => {
    const message = await resolveAuthErrorMessage(
      "signup",
      jsonResponse(400, { error: "Password must include a digit" }),
    );
    expect(message).toBe("Password must include a digit");
  });

  it("maps CAPTCHA verification failure to the signup verification copy", async () => {
    const message = await resolveAuthErrorMessage(
      "signup",
      jsonResponse(400, { error: "Verification failed" }),
    );
    expect(message).toBe("signup.verificationFailed");
  });

  it("maps rate limiting to the shared too-many-attempts copy", async () => {
    const message = await resolveAuthErrorMessage(
      "login",
      jsonResponse(429, { error: "Too many requests" }),
    );
    expect(message).toBe("auth.tooManyAttempts");
  });
});
