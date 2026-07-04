import { describe, expect, it, vi } from "vitest";
import { verifyProduction } from "./production-verify.mjs";

function mockFetch(handlers) {
  return vi.fn(async (url, init = {}) => {
    const path = new URL(url).pathname;
    const handler = handlers[path];
    if (!handler) {
      throw new Error(`Unexpected fetch: ${path}`);
    }
    return handler(init);
  });
}

describe("verifyProduction", () => {
  it("passes when health is public, login sets a session, and /api/auth/me works", async () => {
    const fetchFn = mockFetch({
      "/": () =>
        new Response("<html><title>HourDen</title></html>", { status: 200 }),
      "/api/health": () =>
        Response.json({ ok: true }, { status: 200 }),
      "/api/auth/login": () =>
        new Response(
          JSON.stringify({
            user: { email: "operator@test.hourden.local" },
            activeWorkspaceId: "default",
          }),
          {
            status: 200,
            headers: {
              "set-cookie":
                "hourden_session=sess-abc; Path=/; HttpOnly; SameSite=Lax",
            },
          },
        ),
      "/api/auth/me": (init) => {
        const cookie =
          init.headers instanceof Headers
            ? init.headers.get("cookie")
            : init.headers?.cookie;
        expect(cookie).toContain("hourden_session=sess-abc");
        return Response.json(
          {
            user: { email: "operator@test.hourden.local" },
            activeWorkspaceId: "default",
          },
          { status: 200 },
        );
      },
    });

    await expect(
      verifyProduction({
        baseUrl: "https://hourden.example.com",
        operatorEmail: "operator@test.hourden.local",
        operatorPassword: "TestPass1",
        fetchFn,
      }),
    ).resolves.toBeUndefined();

    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("rejects when login succeeds but protected /api/auth/me returns 401", async () => {
    const fetchFn = mockFetch({
      "/": () =>
        new Response("<html><title>HourDen</title></html>", { status: 200 }),
      "/api/health": () =>
        Response.json({ ok: true }, { status: 200 }),
      "/api/auth/login": () =>
        new Response(
          JSON.stringify({
            user: { email: "operator@test.hourden.local" },
          }),
          {
            status: 200,
            headers: {
              "set-cookie": "hourden_session=sess-abc; Path=/; HttpOnly",
            },
          },
        ),
      "/api/auth/me": () => new Response(null, { status: 401 }),
    });

    await expect(
      verifyProduction({
        baseUrl: "https://hourden.example.com",
        operatorEmail: "operator@test.hourden.local",
        operatorPassword: "TestPass1",
        fetchFn,
      }),
    ).rejects.toThrow(/session/i);
  });
});
