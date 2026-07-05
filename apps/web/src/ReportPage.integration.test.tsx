import "./test/load-env.js";

import { Pool } from "pg";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupAuthenticatedApiFetch } from "./test/authenticated-api.js";
import ReportPage from "./ReportPage.js";

const databaseUrl = process.env.DATABASE_URL;
const JUNE_2026 = new Date("2026-06-15T12:00:00.000Z");

async function createClient(
  name: string,
  defaultRate = 60,
): Promise<{ id: string }> {
  const res = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, defaultRate }),
  });
  return res.json() as Promise<{ id: string }>;
}

async function createProject(
  clientId: string,
  name: string,
): Promise<{ id: string }> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, name }),
  });
  return res.json() as Promise<{ id: string }>;
}

describe.skipIf(!databaseUrl)("ReportPage with live API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let restoreFetch: () => void;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(JUNE_2026);
    ({ restoreFetch } = await setupAuthenticatedApiFetch(pool));
  });

  beforeEach(async () => {
    vi.setSystemTime(JUNE_2026);
    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(async () => {
    restoreFetch();
    await pool.end();
    vi.useRealTimers();
  });

  it("shows entries grouped by Client for the selected date range", async () => {
    const bandao = await createClient("Bandao", 60);
    const ondojo = await createProject(bandao.id, "Ondojo");

    await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "App Development",
        startedAt: "2026-06-18T14:33:00.000Z",
        endedAt: "2026-06-18T15:39:00.000Z",
      }),
    });

    await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "App Development",
        startedAt: "2026-06-18T09:43:00.000Z",
        endedAt: "2026-06-18T09:51:00.000Z",
      }),
    });

    render(<ReportPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Bandao" })).toBeInTheDocument();
      expect(screen.getByText("App Development")).toBeInTheDocument();
      expect(screen.getAllByText(/1:14/)).toHaveLength(2);
      expect(screen.getAllByText(/€74\.00/)).toHaveLength(2);
    });
  });

  it("downloads a Clockify-shaped CSV when Export CSV is clicked", async () => {
    const bandao = await createClient("Bandao", 60);
    const ondojo = await createProject(bandao.id, "Ondojo");

    await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: ondojo.id,
        description: "Development Call",
        tags: ["Communication"],
        startedAt: "2026-06-22T08:00:00.000Z",
        endedAt: "2026-06-22T08:13:00.000Z",
      }),
    });

    URL.createObjectURL = vi.fn(() => "blob:test") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    render(<ReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Development Call")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    clickSpy.mockRestore();
  });
});
