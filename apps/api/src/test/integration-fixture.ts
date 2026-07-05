import type { Hono } from "hono";
import { Pool } from "pg";
import { vi } from "vitest";
import { createApp } from "../app.js";
import {
  createUserWithWorkspace,
  type CreateUserWithWorkspaceInput,
} from "../db/workspaces.js";
import {
  bindSessionAuth,
  loginAsOperator,
  withSessionCookie,
} from "./auth-helper.js";
import { runMigrationsForTests } from "./migrate-for-tests.js";

export type IntegrationSurface = "api" | "web";

interface IntegrationWorkspaceBase {
  pool: Pool;
  app: Hono;
  sessionCookie: string;
  /** Flush pending async work between tests (React effects, microtasks). */
  flushAsync: () => Promise<void>;
  /** Restore fetch (web), drain async work, end pool — safe to call once. */
  teardown: () => Promise<void>;
}

export interface ApiIntegrationWorkspace extends IntegrationWorkspaceBase {
  surface: "api";
}

export interface WebIntegrationWorkspace extends IntegrationWorkspaceBase {
  surface: "web";
}

export interface FreshUserIntegrationWorkspace extends WebIntegrationWorkspace {
  workspaceId: string;
}

export type AuthenticatedIntegrationWorkspace =
  | ApiIntegrationWorkspace
  | WebIntegrationWorkspace;

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for integration fixtures");
  }
  return url;
}

/** Hono app.request bodies are not always readable from jsdom fetch consumers. */
async function materializeResponse(res: Response): Promise<Response> {
  const headers = new Headers();
  res.headers.forEach((value, key) => {
    headers.set(key, value);
  });
  const body = res.body ? await res.arrayBuffer() : null;
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function sessionCookieFromLoginResponse(loginRes: Response): string {
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/hourden_session=([^;]+)/);
  if (!match) {
    throw new Error("Session cookie not found in Set-Cookie header");
  }
  return `hourden_session=${match[1]}`;
}

function createFetchProxy(
  app: Hono,
  originalFetch: typeof fetch,
  isClosed: () => boolean,
): typeof fetch {
  const fetchProxy = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (url.startsWith("/api/") || url.includes("/api/")) {
      if (isClosed()) {
        return new Response(JSON.stringify({ error: "Integration fixture teardown" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }

      const path = url.startsWith("/api/")
        ? url
        : url.slice(url.indexOf("/api/"));
      return materializeResponse(await app.request(path, init));
    }

    return originalFetch(input, init);
  }) as typeof fetch;

  return fetchProxy;
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function createAuthenticatedContext(
  surface: IntegrationSurface,
  databaseUrl?: string,
): Promise<AuthenticatedIntegrationWorkspace> {
  const pool = new Pool({ connectionString: resolveDatabaseUrl(databaseUrl) });
  await runMigrationsForTests(pool);

  const app = createApp({ pool });
  const sessionCookie = await loginAsOperator(app);
  await bindSessionAuth(app);

  let closed = false;
  let restoreFetch: (() => void) | undefined;

  if (surface === "web") {
    vi.unstubAllGlobals();
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      createFetchProxy(app, originalFetch, () => closed),
    );
    restoreFetch = () => {
      vi.unstubAllGlobals();
      globalThis.fetch = originalFetch;
    };
  }

  const teardown = async () => {
    if (closed) {
      return;
    }
    closed = true;
    restoreFetch?.();
    await flushAsyncWork();
    await pool.end();
  };

  if (surface === "api") {
    return {
      surface: "api",
      pool,
      app,
      sessionCookie,
      flushAsync: flushAsyncWork,
      teardown,
    };
  }

  return {
    surface: "web",
    pool,
    app,
    sessionCookie,
    flushAsync: flushAsyncWork,
    teardown,
  };
}

export async function withAuthenticatedWorkspace(
  surface: "api",
  databaseUrl?: string,
): Promise<ApiIntegrationWorkspace>;
export async function withAuthenticatedWorkspace(
  surface: "web",
  databaseUrl?: string,
): Promise<WebIntegrationWorkspace>;
export async function withAuthenticatedWorkspace(
  surface: IntegrationSurface,
  databaseUrl?: string,
): Promise<AuthenticatedIntegrationWorkspace> {
  return createAuthenticatedContext(surface, databaseUrl);
}

export async function deleteFreshUserArtifacts(
  pool: Pool,
  email: string,
  workspaceName: string,
): Promise<void> {
  await pool.query(
    "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
    [email],
  );
  await pool.query(
    "DELETE FROM workspace_memberships WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
    [email],
  );
  await pool.query(
    "DELETE FROM time_entries WHERE workspace_id IN (SELECT id FROM workspaces WHERE name = $1)",
    [workspaceName],
  );
  await pool.query(
    "DELETE FROM projects WHERE workspace_id IN (SELECT id FROM workspaces WHERE name = $1)",
    [workspaceName],
  );
  await pool.query(
    "DELETE FROM clients WHERE workspace_id IN (SELECT id FROM workspaces WHERE name = $1)",
    [workspaceName],
  );
  await pool.query("DELETE FROM workspaces WHERE name = $1", [workspaceName]);
  await pool.query("DELETE FROM users WHERE email = $1", [email]);
}

export async function withFreshUserWorkspace(
  surface: "web",
  input: CreateUserWithWorkspaceInput,
  databaseUrl?: string,
): Promise<FreshUserIntegrationWorkspace> {
  const pool = new Pool({ connectionString: resolveDatabaseUrl(databaseUrl) });
  await deleteFreshUserArtifacts(pool, input.email, input.workspaceName);
  await runMigrationsForTests(pool);

  const app = createApp({ pool });
  const created = await createUserWithWorkspace(pool, input);

  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: input.email, password: input.password }),
  });
  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  const sessionCookie = sessionCookieFromLoginResponse(loginRes);

  const originalRequest = app.request.bind(app);
  app.request = ((requestInput: RequestInfo | URL, init?: RequestInit) =>
    originalRequest(
      requestInput,
      withSessionCookie(init ?? {}, sessionCookie),
    )) as typeof app.request;

  let closed = false;
  vi.unstubAllGlobals();
  const originalFetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    createFetchProxy(app, originalFetch, () => closed),
  );

  const teardown = async () => {
    if (closed) {
      return;
    }
    closed = true;
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
    await flushAsyncWork();
    await pool.end();
  };

  return {
    surface: "web",
    pool,
    app,
    sessionCookie,
    workspaceId: created.workspaceId,
    flushAsync: flushAsyncWork,
    teardown,
  };
}
