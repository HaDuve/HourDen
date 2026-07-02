import { Hono } from "hono";
import { healthPayload } from "./health.js";
import { apiKeyAuth } from "./middleware/api-key.js";

export function createApp() {
  const app = new Hono();

  app.use("*", apiKeyAuth);
  app.get("/health", (c) => c.json(healthPayload()));

  const api = new Hono();
  api.get("/health", (c) => c.json(healthPayload()));
  app.route("/api", api);

  return app;
}

export const app = createApp();
