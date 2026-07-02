import { serve, type ServerType } from "@hono/node-server";
import { render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../api/src/app.js";
import App from "./App.js";

describe("App with live API", () => {
  let server: ServerType;
  let baseUrl: string;
  let originalFetch: typeof fetch;

  beforeAll(async () => {
    originalFetch = globalThis.fetch;
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = serve({ fetch: app.fetch, port: 0 }, (info) => {
        baseUrl = `http://127.0.0.1:${info.port}`;
        resolve();
      });
    });

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (url.startsWith("/api/")) {
        return originalFetch(`${baseUrl}${url}`, init);
      }

      return originalFetch(input, init);
    }) as typeof fetch;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("shows API health status from a real health endpoint", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/API status: ok/i)).toBeInTheDocument();
    });
  });
});
