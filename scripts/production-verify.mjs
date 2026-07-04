/**
 * Production verification against a live HourDen deployment.
 * Used by scripts/verify-production.sh (session login, no Caddy basic auth).
 */

function sessionCookieFromResponse(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Login did not return a session cookie");
  }

  const match = setCookie.match(/hourden_session=([^;]+)/);
  if (!match) {
    throw new Error("Login Set-Cookie missing hourden_session");
  }

  return `hourden_session=${match[1]}`;
}

async function expectOk(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}`);
  }
}

/**
 * @param {{
 *   baseUrl: string;
 *   operatorEmail: string;
 *   operatorPassword: string;
 *   fetchFn?: typeof fetch;
 * }} options
 */
export async function verifyProduction({
  baseUrl,
  operatorEmail,
  operatorPassword,
  fetchFn = fetch,
}) {
  const root = baseUrl.replace(/\/$/, "");

  const indexRes = await fetchFn(`${root}/`);
  await expectOk(indexRes, "GET /");
  const indexHtml = await indexRes.text();
  if (!indexHtml.includes("HourDen")) {
    throw new Error("GET / did not return HourDen SPA HTML");
  }

  const healthRes = await fetchFn(`${root}/api/health`);
  await expectOk(healthRes, "GET /api/health");
  const health = await healthRes.json();
  if (health.ok !== true) {
    throw new Error("GET /api/health did not return { ok: true }");
  }

  const loginRes = await fetchFn(`${root}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: operatorEmail,
      password: operatorPassword,
    }),
  });
  await expectOk(loginRes, "POST /api/auth/login");

  const loginBody = await loginRes.json();
  if (loginBody.user?.email !== operatorEmail) {
    throw new Error("Login response did not include operator email");
  }

  const sessionCookie = sessionCookieFromResponse(loginRes);

  const meRes = await fetchFn(`${root}/api/auth/me`, {
    headers: { cookie: sessionCookie },
  });
  if (meRes.status === 401) {
    throw new Error("Protected /api/auth/me rejected the session cookie");
  }
  await expectOk(meRes, "GET /api/auth/me");

  const meBody = await meRes.json();
  if (meBody.user?.email !== operatorEmail) {
    throw new Error("/api/auth/me did not return the operator user");
  }

  const clientsRes = await fetchFn(`${root}/api/clients`, {
    headers: { cookie: sessionCookie },
  });
  if (clientsRes.status === 401) {
    throw new Error("Protected GET /api/clients rejected the session cookie");
  }
  await expectOk(clientsRes, "GET /api/clients");
}
