import "../test/load-env.js";

import { Pool } from "pg";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { setupFreshUserApiFetch } from "../test/authenticated-api.js";
import { authenticatedAppRoutes } from "../routes.js";

const databaseUrl = process.env.DATABASE_URL;

const QA_EMAIL = "onboarding-web-qa@test.hourden.local";
const QA_PASSWORD = "QaTestPass1";
const QA_WORKSPACE = "Onboarding Web QA Workspace";

function renderApp(initialPath = "/") {
  const router = createMemoryRouter(authenticatedAppRoutes, { initialEntries: [initialPath] });
  render(<RouterProvider router={router} />);
  return router;
}

describe.skipIf(!databaseUrl)("Onboarding flow with live API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let restoreFetch: () => void;

  beforeAll(async () => {
    await pool.query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [
      QA_EMAIL,
    ]);
    await pool.query("DELETE FROM workspace_memberships WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [
      QA_EMAIL,
    ]);
    await pool.query("DELETE FROM projects WHERE workspace_id IN (SELECT id FROM workspaces WHERE name = $1)", [
      QA_WORKSPACE,
    ]);
    await pool.query("DELETE FROM clients WHERE workspace_id IN (SELECT id FROM workspaces WHERE name = $1)", [
      QA_WORKSPACE,
    ]);
    await pool.query("DELETE FROM workspaces WHERE name = $1", [QA_WORKSPACE]);
    await pool.query("DELETE FROM users WHERE email = $1", [QA_EMAIL]);

    ({ restoreFetch } = await setupFreshUserApiFetch(pool, {
      email: QA_EMAIL,
      password: QA_PASSWORD,
      workspaceName: QA_WORKSPACE,
    }));
  });

  beforeEach(async () => {
    await pool.query(
      `
        UPDATE workspaces
        SET onboarding_completed_at = NULL
        WHERE name = $1
      `,
      [QA_WORKSPACE],
    );
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(async () => {
    restoreFetch();
    await pool.end();
  });

  it("api reports that the fresh QA workspace needs onboarding", async () => {
    const res = await fetch("/api/workspace/onboarding");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ needsOnboarding: true, completedAt: null });
  });

  it("redirects a fresh workspace from Tracker to the client onboarding step", async () => {
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /get started/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /add your first client/i })).toBeInTheDocument();
    });
  });

  it("shows the client onboarding step for a fresh workspace", async () => {
    renderApp("/onboarding/client");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /get started/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /add your first client/i })).toBeInTheDocument();
    });
  });

  it("lands on Tracker after skipping and does not reopen onboarding", async () => {
    renderApp("/onboarding/client");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^skip$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
    });

    cleanup();
    renderApp("/");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /get started/i })).not.toBeInTheDocument();
    });
  });
});
