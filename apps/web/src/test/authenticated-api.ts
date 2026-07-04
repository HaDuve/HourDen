import type { Hono } from "hono";
import type { Pool } from "pg";
import { createApp } from "../../api/src/app.js";
import { runMigrations } from "../../api/src/db/migrate.js";
import {
  bindSessionFetch,
  loginAsOperator,
} from "../../api/src/test/auth-helper.js";

export async function setupAuthenticatedApiFetch(
  pool: Pool,
): Promise<{ app: Hono; restoreFetch: () => void }> {
  const originalFetch = globalThis.fetch;
  await runMigrations(pool);

  const app = createApp({ pool });
  const cookie = await loginAsOperator(app);
  globalThis.fetch = bindSessionFetch(
    app,
    cookie,
    originalFetch,
  ) as typeof fetch;

  return {
    app,
    restoreFetch: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
