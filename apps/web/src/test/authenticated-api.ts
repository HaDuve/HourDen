import type { Hono } from "hono";
import type { Pool } from "pg";
import { vi } from "vitest";
import { createApp } from "../../../api/src/app.js";
import { runMigrationsForTests } from "../../../api/src/test/migrate-for-tests.js";
import {
  bindSessionAuth,
  withSessionCookie,
} from "../../../api/src/test/auth-helper.js";
import {
  createUserWithWorkspace,
  type CreateUserWithWorkspaceInput,
} from "../../../api/src/db/workspaces.js";

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

export async function setupAuthenticatedApiFetch(
  pool: Pool,
): Promise<{ app: Hono; restoreFetch: () => void }> {
  vi.unstubAllGlobals();
  const originalFetch = globalThis.fetch;
  await runMigrationsForTests(pool);

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

function sessionCookieFromLoginResponse(loginRes: Response): string {
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/hourden_session=([^;]+)/);
  if (!match) {
    throw new Error("Session cookie not found in Set-Cookie header");
  }
  return `hourden_session=${match[1]}`;
}

export async function setupFreshUserApiFetch(
  pool: Pool,
  input: CreateUserWithWorkspaceInput,
): Promise<{ app: Hono; restoreFetch: () => void; workspaceId: string }> {
  vi.unstubAllGlobals();
  const originalFetch = globalThis.fetch;
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
  const cookie = sessionCookieFromLoginResponse(loginRes);

  const fetchProxy = (async (urlInput: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof urlInput === "string"
        ? urlInput
        : urlInput instanceof URL
          ? urlInput.href
          : urlInput.url;

    if (url.startsWith("/api/") || url.includes("/api/")) {
      const path = url.startsWith("/api/")
        ? url
        : url.slice(url.indexOf("/api/"));
      return materializeResponse(
        await app.request(path, withSessionCookie(init ?? {}, cookie)),
      );
    }

    return originalFetch(urlInput, init);
  }) as typeof fetch;

  vi.stubGlobal("fetch", fetchProxy);

  return {
    app,
    workspaceId: created.workspaceId,
    restoreFetch: () => {
      vi.unstubAllGlobals();
      globalThis.fetch = originalFetch;
    },
  };
}