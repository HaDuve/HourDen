import { describe, expect, it, afterEach } from "vitest";
import { createApp } from "../app.js";

describe("API key auth", () => {
  afterEach(() => {
    delete process.env.HOURDEN_API_KEY;
  });

  it("allows /api requests when no API key is configured", async () => {
    const app = createApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
  });

  it("rejects /api requests without a valid key when configured", async () => {
    process.env.HOURDEN_API_KEY = "test-secret";
    const app = createApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(401);
  });

  it("rejects /health without a valid key when configured", async () => {
    process.env.HOURDEN_API_KEY = "test-secret";
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(401);
  });

  it("accepts /api requests with a valid x-api-key header", async () => {
    process.env.HOURDEN_API_KEY = "test-secret";
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { "x-api-key": "test-secret" },
    });
    expect(res.status).toBe(200);
  });
});
