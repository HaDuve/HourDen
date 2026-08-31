import "./test/load-env.js";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { createApp } from "../../api/src/app.js";
import {
  deleteFreshUserArtifacts,
} from "../../api/src/test/integration-fixture.js";
import { runMigrationsForTests } from "../../api/src/test/migrate-for-tests.js";
import { withSessionCookie } from "../../api/src/test/auth-helper.js";
import { authenticatedAppRoutes, appRoutes } from "./routes.js";

const databaseUrl = process.env.DATABASE_URL;
const REGISTER_EMAIL = "login-page-register@test.hourden.local";
const REGISTER_PASSWORD = "RegisterPass1";
const REGISTER_WORKSPACE = "My Den";

function sessionCookieFromResponse(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/hourden_session=([^;]+)/);
  if (!match) {
    throw new Error("Session cookie not found in Set-Cookie header");
  }
  return `hourden_session=${match[1]}`;
}

describe.skipIf(!databaseUrl)("LoginPage signup with live API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let app = createApp({
    pool,
    auth: {
      verifyTurnstile: async () => true,
      rateLimiters: null,
    },
  });
  let sessionCookie = "";
  let restoreFetch: (() => void) | undefined;

  beforeAll(async () => {
    await runMigrationsForTests(pool);
  });

  beforeEach(async () => {
    await deleteFreshUserArtifacts(pool, REGISTER_EMAIL, REGISTER_WORKSPACE);
    sessionCookie = "";

    app = createApp({
      pool,
      auth: {
        verifyTurnstile: async () => true,
        rateLimiters: null,
      },
    });

    vi.unstubAllGlobals();
    const originalFetch = globalThis.fetch;
    const fetchProxy = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (url.startsWith("/api/") || url.includes("/api/")) {
        const path = url.startsWith("/api/") ? url : url.slice(url.indexOf("/api/"));
        const requestInit =
          sessionCookie.length > 0 ? withSessionCookie(init ?? {}, sessionCookie) : init;
        const res = await app.request(path, requestInit);
        const body = res.body ? await res.arrayBuffer() : null;
        const headers = new Headers();
        res.headers.forEach((value, key) => {
          headers.set(key, value);
        });
        const materialized = new Response(body, {
          status: res.status,
          statusText: res.statusText,
          headers,
        });

        if (path === "/api/auth/register" && res.status === 201) {
          sessionCookie = sessionCookieFromResponse(materialized);
          app = createApp({
            pool,
            auth: {
              verifyTurnstile: async () => true,
              rateLimiters: null,
            },
          });
          const originalRequest = app.request.bind(app);
          app.request = ((requestInput: RequestInfo | URL, initArg?: RequestInit) =>
            originalRequest(
              requestInput,
              withSessionCookie(initArg ?? {}, sessionCookie),
            )) as typeof app.request;
        }

        return materialized;
      }

      return originalFetch(input, init);
    }) as typeof fetch;

    vi.stubGlobal("fetch", fetchProxy);
    restoreFetch = () => {
      vi.unstubAllGlobals();
      globalThis.fetch = originalFetch;
    };
  });

  afterEach(() => {
    cleanup();
    restoreFetch?.();
  });

  afterAll(async () => {
    restoreFetch?.();
    await pool.end();
  });

  it("registers through the signup form and lands on client onboarding", async () => {
    const loginRouter = createMemoryRouter(appRoutes, {
      initialEntries: ["/login?mode=signup"],
    });
    render(<RouterProvider router={loginRouter} />);

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: REGISTER_EMAIL },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: REGISTER_PASSWORD },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));

    await waitFor(() => {
      expect(sessionCookie).toMatch(/^hourden_session=/);
    });

    cleanup();

    const appRouter = createMemoryRouter(authenticatedAppRoutes, {
      initialEntries: ["/"],
    });
    render(<RouterProvider router={appRouter} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /get started/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /add your first client/i })).toBeInTheDocument();
    });
  });
});
