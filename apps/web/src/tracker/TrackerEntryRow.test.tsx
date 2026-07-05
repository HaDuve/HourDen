import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "../i18n/i18n.js";
import { createMatchMedia } from "../test/match-media.js";
import { TrackerEntryRow } from "./TrackerEntryRow.js";

const project = {
  id: "p0000000-0000-4000-8000-000000000001",
  clientId: "c0000000-0000-4000-8000-000000000001",
  name: "Acme Project",
  color: null,
};

const projectGroups = [
  {
    clientId: project.clientId,
    clientName: "Acme Client",
    projects: [project],
  },
];

const stoppedEntry = {
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

function renderRow(
  overrides: Partial<Parameters<typeof TrackerEntryRow>[0]> = {},
) {
  const onPatch = vi.fn().mockResolvedValue(undefined);
  render(
    <TrackerEntryRow
      entry={stoppedEntry}
      projectName={null}
      projectGroups={projectGroups}
      isMobile={false}
      formatDurationMinutes={(m) => `${m} min`}
      formatCurrency={(amount) => `€${amount.toFixed(2)}`}
      formatDateTime={() => "Jul 2, 08:00"}
      saving={false}
      onPatch={onPatch}
      onDelete={() => undefined}
      onMobileEdit={() => undefined}
      {...overrides}
    />,
  );
  return { onPatch };
}

describe("TrackerEntryRow", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;
  });

  it("patches description when the inline field is saved on desktop", async () => {
    const { onPatch } = renderRow();

    fireEvent.click(screen.getByRole("button", { name: /morning work/i }));

    const input = screen.getByLabelText(/^description$/i);
    fireEvent.change(input, { target: { value: "Updated work" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onPatch).toHaveBeenCalledWith({ description: "Updated work" });
    });
  });

  it("patches project when a client-grouped option is selected on desktop", async () => {
    const { onPatch } = renderRow();

    fireEvent.click(screen.getByRole("button", { name: /no project/i }));

    fireEvent.change(screen.getByLabelText(/project \(optional\)/i), {
      target: { value: project.id },
    });

    await waitFor(() => {
      expect(onPatch).toHaveBeenCalledWith({ projectId: project.id });
    });
  });

  it("patches startedAt when the inline start field is saved on desktop", async () => {
    const { onPatch } = renderRow();

    fireEvent.click(screen.getByRole("button", { name: /^start:/i }));

    const startInput = screen.getByLabelText(/^start$/i);
    fireEvent.change(startInput, { target: { value: "2026-07-02T07:30" } });
    fireEvent.blur(startInput);

    await waitFor(() => {
      expect(onPatch).toHaveBeenCalledWith({
        startedAt: new Date("2026-07-02T07:30").toISOString(),
      });
    });
  });

  it("does not offer inline edit controls for invoiced entries", () => {
    renderRow({
      entry: { ...stoppedEntry, invoiced: true },
    });

    expect(screen.queryByRole("button", { name: /morning work/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("opens the mobile edit sheet when a stopped entry row is tapped", () => {
    const onMobileEdit = vi.fn();
    renderRow({ isMobile: true, onMobileEdit });

    fireEvent.click(
      screen.getByRole("button", {
        name: /morning work no project · jul 2, 08:00 – jul 2, 08:00/i,
      }),
    );

    expect(onMobileEdit).toHaveBeenCalled();
  });
});
