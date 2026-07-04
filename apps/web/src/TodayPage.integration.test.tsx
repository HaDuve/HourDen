import "./test/load-env.js";

import { Pool } from "pg";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupAuthenticatedApiFetch } from "./test/authenticated-api.js";
import TodayPage from "./TodayPage.js";
import { todayLocalDate } from "./today-date.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("TodayPage with live API", () => {
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

  it("lists today's entries and supports start/stop and manual add", async () => {
    const today = todayLocalDate();
    const start = `${today}T09:00`;
    const end = `${today}T10:00`;

    render(<TodayPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /today/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add manual entry/i }));
    fireEvent.change(screen.getByLabelText(/^description$/i), {
      target: { value: "Planning session" },
    });
    fireEvent.change(screen.getByLabelText(/^start$/i), {
      target: { value: start },
    });
    fireEvent.change(screen.getByLabelText(/^end$/i), {
      target: { value: end },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Planning session")).toBeInTheDocument();
      expect(screen.getByText(/1 h/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /start timer/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stop timer/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /stop timer/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start timer/i })).toBeInTheDocument();
    });

    const listRes = await fetch(`/api/time-entries?date=${today}`);
    const { entries } = (await listRes.json()) as { entries: unknown[] };
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it("lets the Operator add a description to an incomplete stopped entry", async () => {
    render(<TodayPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start timer/i })).toBeInTheDocument();
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
});
