import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_ID } from "@hourden/domain";
import { createApp } from "./app.js";

const expectedHealth = { status: "ok", workspaceId: DEFAULT_WORKSPACE_ID };

describe("GET /health", () => {
  it("returns ok status and workspace id", async () => {
    const app = createApp();
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expectedHealth);
  });
});

describe("GET /api/health", () => {
  it("returns ok status for the proxied path", async () => {
    const app = createApp();
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expectedHealth);
  });
});
