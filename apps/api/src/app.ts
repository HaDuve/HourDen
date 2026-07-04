import { Hono } from "hono";
import type { Pool } from "pg";
import { createImportRouter } from "./import.js";
import { createClientsRouter } from "./clients.js";
import { createInvoicesRouter } from "./invoices.js";
import { createProjectsRouter } from "./projects.js";
import { createReportsRouter } from "./reports.js";
import { createTimeEntriesRouter } from "./time-entries.js";
import { createWorkspaceSettingsRouter } from "./workspace-settings.js";
import { createAuthRouter } from "./auth/routes.js";
import { pool } from "./db/pool.js";
import { healthPayload } from "./health.js";
import { createAuthMiddleware } from "./middleware/auth.js";

type AppOptions = {
  pool?: Pool;
};

export function createApp(options: AppOptions = {}) {
  const db = options.pool ?? pool;
  const app = new Hono();

  app.use("*", createAuthMiddleware(db));
  app.get("/health", (c) => c.json(healthPayload()));

  const api = new Hono();
  api.get("/health", (c) => c.json(healthPayload()));
  api.route("/auth", createAuthRouter(db));
  api.route("/clients", createClientsRouter(db));
  api.route("/import", createImportRouter(db));
  api.route("/projects", createProjectsRouter(db));
  api.route("/reports", createReportsRouter(db));
  api.route("/invoices", createInvoicesRouter(db));
  api.route("/time-entries", createTimeEntriesRouter(db));
  api.route("/workspace", createWorkspaceSettingsRouter(db));

  app.route("/api", api);

  return app;
}

export const app = createApp();
