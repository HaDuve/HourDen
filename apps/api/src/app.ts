import { Hono } from "hono";
import { apiKeyAuth } from "./middleware/api-key.js";

export function createApp() {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  const api = new Hono();
  api.use("*", apiKeyAuth);
  api.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/api", api);

  return app;
}

export const app = createApp();
