import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TodayPage from "./TodayPage.js";

vi.mock("./today-date.js", () => ({
  todayLocalDate: () => "2026-07-02",
}));

const morningEntry = {
  id: "e0000000-0000-4000-8000-000000000001",
  projectId: null,
  startedAt: "2026-07-02T08:00:00.000Z",
  endedAt: "2026-07-02T09:00:00.000Z",
  description: "Morning work",
  tags: [],
  billable: true,
  amount: 60,
  billableComplete: true,
  isRunning: false,
  durationMinutes: 60,
  invoiced: false,
};

const afternoonEntry = {
  id: "e0000000-0000-4000-8000-000000000002",
  projectId: null,
  startedAt: "2026-07-02T13:00:00.000Z",
  endedAt: "2026-07-02T14:00:00.000Z",
  description: "Afternoon work",
  tags: [],
  billable: true,
  amount: 60,
  billableComplete: true,
  isRunning: false,
  durationMinutes: 60,
  invoiced: false,
};

function mockTodayLoad(
  entries: typeof morningEntry[],
  running: typeof morningEntry | null = null,
) {
  return vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entry: running }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ projects: [] }),
    });
}

describe("TodayPage", () => {
  it("deletes the Time Entry chosen when the dialog opened, even if another row Delete is clicked", async () => {
    const fetchMock = mockTodayLoad([morningEntry, afternoonEntry])
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
      })
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ entries: [morningEntry] }),
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ entry: null }),
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ projects: [] }),
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<TodayPage />);
    await waitFor(() => {
      expect(screen.getByText("Afternoon work")).toBeInTheDocument();
    });

    const listDeleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(listDeleteButtons[1]!);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.click(listDeleteButtons[0]!);
    fireEvent.click(screen.getByRole("button", { name: /^confirm delete$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/time-entries/${afternoonEntry.id}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
