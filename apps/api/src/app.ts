import { Hono } from "hono";
import type { Pool } from "pg";
import { createClientsRouter } from "./clients.js";
import { pool } from "./db/pool.js";
import { healthPayload } from "./health.js";
import { apiKeyAuth } from "./middleware/api-key.js";

type AppOptions = {
  pool?: Pool;
};

export function createApp(options: AppOptions = {}) {
  const db = options.pool ?? pool;
  const app = new Hono();

  app.use("*", apiKeyAuth);
  app.get("/health", (c) => c.json(healthPayload()));

  const api = new Hono();
  api.get("/health", (c) => c.json(healthPayload()));
  api.route("/clients", createClientsRouter(db));

  app.route("/api", api);

  return app;
}

export const app = createApp();
