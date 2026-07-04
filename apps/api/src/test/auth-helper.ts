import type { Hono } from "hono";

export async function loginAsOperator(
  app: Hono,
  email = process.env.HOURDEN_OPERATOR_EMAIL ?? "operator@test.hourden.local",
  password = process.env.HOURDEN_OPERATOR_PASSWORD ?? "TestPass1",
): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }

  const cookie = res.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("Login did not set a session cookie");
  }

  const match = cookie.match(/hourden_session=([^;]+)/);
  if (!match) {
    throw new Error("Session cookie not found in Set-Cookie header");
  }

  return `hourden_session=${match[1]}`;
}

export function withSessionCookie(
  init: RequestInit = {},
  cookie: string,
): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);
  return { ...init, headers };
}

/** Attach session cookie to every app.request call (integration tests). */
export async function bindSessionAuth(app: Hono): Promise<void> {
  const cookie = await loginAsOperator(app);
  const originalRequest = app.request.bind(app);
  app.request = ((input: RequestInfo | URL, init?: RequestInit) =>
    originalRequest(input, withSessionCookie(init ?? {}, cookie))) as typeof app.request;
}

/** Attach session cookie to proxied /api fetch calls (web integration tests). */
export function bindSessionFetch(
  app: Hono,
  cookie: string,
  originalFetch: typeof fetch = globalThis.fetch,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
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
      return app.request(path, withSessionCookie(init ?? {}, cookie));
    }

    return originalFetch(input, init);
  };
}
