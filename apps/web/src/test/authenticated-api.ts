import type { Hono } from "hono";
import type { Pool } from "pg";
import { vi } from "vitest";
import { createApp } from "../../../api/src/app.js";
import { runMigrations } from "../../../api/src/db/migrate.js";
import { bindSessionAuth } from "../../../api/src/test/auth-helper.js";

/** Hono app.request bodies are not always readable from jsdom fetch consumers. */
async function materializeResponse(res: Response): Promise<Response> {
  const body = res.body ? await res.arrayBuffer() : null;
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

export async function setupAuthenticatedApiFetch(
  pool: Pool,
): Promise<{ app: Hono; restoreFetch: () => void }> {
  vi.unstubAllGlobals();
  const originalFetch = globalThis.fetch;
  await runMigrations(pool);

  const app = createApp({ pool });
  await bindSessionAuth(app);

  const fetchProxy = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (url.startsWith("/api/") || url.includes("/api/")) {
      const path = url.startsWith("/api/")
        ? url
        : url.slice(url.indexOf("/api/"));
      return materializeResponse(await app.request(path, init));
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  vi.stubGlobal("fetch", fetchProxy);

  return {
    app,
    restoreFetch: () => {
      vi.unstubAllGlobals();
      globalThis.fetch = originalFetch;
    },
  };
}