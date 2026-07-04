import { Hono } from "hono";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishWorkspaceEvent } from "./events/workspace-bus.js";
import { createTimeEntriesRouter } from "./time-entries.js";
import { runWithWorkspaceId } from "./workspace.js";

vi.mock("./db/time-entries.js", () => ({
  getRunningTimer: vi.fn(),
  listTimeEntriesForDate: vi.fn(),
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
  createManualEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
}));

vi.mock("./db/workspaces.js", () => ({
  getWorkspaceCalendarTimezone: vi.fn(async () => "UTC"),
}));

vi.mock("./events/workspace-bus.js", () => ({
  publishWorkspaceEvent: vi.fn(),
}));

import {
  createManualEntry,
  deleteTimeEntry,
  startTimer,
  stopTimer,
  updateTimeEntry,
} from "./db/time-entries.js";

const workspaceId = "test-workspace";
const sampleEntry = {
  id: "e0000000-0000-4000-8000-000000000001",
  projectId: null,
  startedAt: "2026-07-04T10:00:00.000Z",
  endedAt: null,
  description: null,
  tags: [],
  billable: true,
  amount: null,
  billableComplete: false,
  isRunning: true,
  durationMinutes: 0,
  invoiced: false,
};

function createTestApp() {
  const app = new Hono();
  app.use("*", async (_c, next) => runWithWorkspaceId(workspaceId, () => next()));
  app.route("/time-entries", createTimeEntriesRouter({} as Pool));
  return app;
}

describe("Time Entry workspace events", () => {
  beforeEach(() => {
    vi.mocked(publishWorkspaceEvent).mockClear();
    vi.mocked(startTimer).mockResolvedValue(sampleEntry);
    vi.mocked(stopTimer).mockResolvedValue({
      ...sampleEntry,
      endedAt: "2026-07-04T11:00:00.000Z",
      isRunning: false,
    });
    vi.mocked(createManualEntry).mockResolvedValue({
      ...sampleEntry,
      endedAt: "2026-07-04T11:00:00.000Z",
      isRunning: false,
    });
    vi.mocked(updateTimeEntry).mockResolvedValue({
      ...sampleEntry,
      endedAt: "2026-07-04T11:00:00.000Z",
      isRunning: false,
    });
    vi.mocked(deleteTimeEntry).mockResolvedValue("deleted");
  });

  it("publishes timer-changed and today-changed when a timer starts", async () => {
    const app = createTestApp();

    const res = await app.request("/time-entries/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    expect(publishWorkspaceEvent).toHaveBeenCalledWith(
      workspaceId,
      "timer-changed",
    );
    expect(publishWorkspaceEvent).toHaveBeenCalledWith(
      workspaceId,
      "today-changed",
    );
  });

  it("publishes timer-changed and today-changed when a timer stops", async () => {
    const app = createTestApp();

    const res = await app.request(`/time-entries/${sampleEntry.id}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(publishWorkspaceEvent).toHaveBeenCalledWith(
      workspaceId,
      "timer-changed",
    );
    expect(publishWorkspaceEvent).toHaveBeenCalledWith(
      workspaceId,
      "today-changed",
    );
  });

  it("publishes today-changed when a manual entry is created", async () => {
    const app = createTestApp();

    const res = await app.request("/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Manual",
        startedAt: "2026-07-04T08:00:00.000Z",
        endedAt: "2026-07-04T09:00:00.000Z",
      }),
    });

    expect(res.status).toBe(201);
    expect(publishWorkspaceEvent).toHaveBeenCalledWith(
      workspaceId,
      "today-changed",
    );
    expect(publishWorkspaceEvent).not.toHaveBeenCalledWith(
      workspaceId,
      "timer-changed",
    );
  });

  it("publishes today-changed when an entry is updated", async () => {
    const app = createTestApp();

    const res = await app.request(`/time-entries/${sampleEntry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Updated" }),
    });

    expect(res.status).toBe(200);
    expect(publishWorkspaceEvent).toHaveBeenCalledWith(
      workspaceId,
      "today-changed",
    );
  });

  it("publishes today-changed when an entry is deleted", async () => {
    const app = createTestApp();

    const res = await app.request(`/time-entries/${sampleEntry.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(publishWorkspaceEvent).toHaveBeenCalledWith(
      workspaceId,
      "today-changed",
    );
  });
});
