import { describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken } from "./turnstile.js";

describe("verifyTurnstileToken", () => {
  it("returns true when Cloudflare siteverify succeeds", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyTurnstileToken("token-123", "203.0.113.1", "secret-key"),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          secret: "secret-key",
          response: "token-123",
          remoteip: "203.0.113.1",
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("returns false when Cloudflare siteverify fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ success: false }),
      })),
    );

    await expect(
      verifyTurnstileToken("token-123", "203.0.113.1", "secret-key"),
    ).resolves.toBe(false);

    vi.unstubAllGlobals();
  });
});
