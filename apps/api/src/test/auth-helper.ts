import type { Hono } from "hono";
import {
  TEST_OPERATOR_EMAIL,
  TEST_OPERATOR_PASSWORD,
} from "./operator-credentials.js";

export async function loginAsOperator(
  app: Hono,
  email = process.env.HOURDEN_OPERATOR_EMAIL ?? TEST_OPERATOR_EMAIL,
  password = process.env.HOURDEN_OPERATOR_PASSWORD ?? TEST_OPERATOR_PASSWORD,
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
export async function bindSessionAuth(app: Hono): Promise<string> {
  const cookie = await loginAsOperator(app);
  const originalRequest = app.request.bind(app);
  app.request = ((input: RequestInfo | URL, init?: RequestInit) =>
    originalRequest(input, withSessionCookie(init ?? {}, cookie))) as typeof app.request;
  return cookie;
}
