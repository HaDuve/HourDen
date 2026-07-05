import "./test/load-env.js";

import { Pool } from "pg";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupAuthenticatedApiFetch } from "./test/authenticated-api.js";
import TrackerPage from "./TrackerPage.js";
import { todayDateInTimeZone } from "./today-date.js";

async function workspaceToday(): Promise<string> {
  const res = await fetch("/api/auth/me");
  const { calendarTimezone } = (await res.json()) as { calendarTimezone: string };
  return todayDateInTimeZone(calendarTimezone);
}

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("TrackerPage with live API", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let restoreFetch: () => void;

  beforeAll(async () => {
    ({ restoreFetch } = await setupAuthenticatedApiFetch(pool));
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM time_entries");
    await pool.query("DELETE FROM projects");
    await pool.query("DELETE FROM clients");
  });

  afterAll(async () => {
    restoreFetch();
    await pool.end();
  });

  it("lists tracker entries and supports start/stop and manual add", async () => {
    const today = await workspaceToday();

    const postRes = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Planning session",
        startedAt: `${today}T08:00:00.000Z`,
        endedAt: `${today}T09:00:00.000Z`,
      }),
    });
    expect(postRes.status).toBe(201);

    render(<TrackerPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tracker/i })).toBeInTheDocument();
      expect(screen.getByText("Planning session")).toBeInTheDocument();
      const entryRow = screen.getByText("Planning session").closest("li");
      expect(entryRow).not.toBeNull();
      expect(within(entryRow!).getByText(/1 h/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add manual entry/i }));
    fireEvent.change(screen.getByLabelText(/^description$/i), {
      target: { value: "Follow-up work" },
    });
    fireEvent.change(screen.getByLabelText(/^start$/i), {
      target: { value: `${today}T10:00` },
    });
    fireEvent.change(screen.getByLabelText(/^end$/i), {
      target: { value: `${today}T11:00` },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Follow-up work")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /start timer/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stop timer/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /stop timer/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start timer/i })).toBeInTheDocument();
    });

    const listRes = await fetch("/api/time-entries?limit=50");
    const { entries } = (await listRes.json()) as { entries: unknown[] };
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });

  it("lets the Operator add a description to an incomplete stopped entry", async () => {
    render(<TrackerPage />);

    await waitFor(() => {
      expect(screen.getByText(/track time with a running timer/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /start timer/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stop timer/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /stop timer/i }));

    await waitFor(() => {
      expect(screen.getByText(/incomplete/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByLabelText(/^description$/i), {
      target: { value: "Wrapped up design review" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Wrapped up design review")).toBeInTheDocument();
      expect(screen.queryByText(/incomplete/i)).not.toBeInTheDocument();
    });
  });

  it("prefills description and project when picking a suggestion on manual entry", async () => {
    const today = await workspaceToday();

    const clientRes = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Autocomplete Client", defaultRate: 80 }),
    });
    const client = (await clientRes.json()) as { id: string };

    const projectRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, name: "Autocomplete Project" }),
    });
    const project = (await projectRes.json()) as { id: string };

    await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Past planning session",
        startedAt: `${today}T06:00:00.000Z`,
        endedAt: `${today}T07:00:00.000Z`,
        projectId: project.id,
      }),
    });

    render(<TrackerPage />);

    await waitFor(() => {
      expect(screen.getByText("Past planning session")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add manual entry/i }));

    const descriptionInput = screen.getByLabelText(/^description$/i);
    fireEvent.change(descriptionInput, { target: { value: "plan" } });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Past planning session" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: "Past planning session" }));

    expect(descriptionInput).toHaveValue("Past planning session");
    expect(screen.getByLabelText(/project \(optional\)/i)).toHaveValue(project.id);
  });
});
