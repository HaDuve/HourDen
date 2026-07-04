import type { Hono } from "hono";
import type { Pool } from "pg";
import { createApp } from "../../../api/src/app.js";
import { runMigrations } from "../../../api/src/db/migrate.js";
import { bindSessionAuth } from "../../../api/src/test/auth-helper.js";

export async function setupAuthenticatedApiFetch(
  pool: Pool,
): Promise<{ app: Hono; restoreFetch: () => void }> {
  const originalFetch = globalThis.fetch;
  await runMigrations(pool);

  const app = createApp({ pool });
  await bindSessionAuth(app);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (url.startsWith("/api/")) {
      return app.request(url, init);
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  return {
    app,
    restoreFetch: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
