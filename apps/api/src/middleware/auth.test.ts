import { describe, expect, it, afterEach } from "vitest";
import { createApp } from "../app.js";

describe("Auth middleware", () => {
  afterEach(() => {
    delete process.env.HOURDEN_API_KEY;
  });

  it("allows public /api/health without credentials", async () => {
    process.env.HOURDEN_API_KEY = "test-secret";
    const app = createApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects protected /api routes without session when no API key is configured", async () => {
    const app = createApp();
    const res = await app.request("/api/clients");
    expect(res.status).toBe(401);
  });
});
