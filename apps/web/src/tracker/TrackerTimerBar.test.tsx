import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "../i18n/i18n.js";
import { localDateValue } from "./localDatetimeValue.js";
import { TrackerTimerBar } from "./TrackerTimerBar.js";
import type { ProjectClientGroup } from "./groupProjectsByClient.js";

const projectGroups: ProjectClientGroup[] = [
  {
    clientId: "c1",
    clientName: "Bandao",
    projects: [
      {
        id: "p1",
        clientId: "c1",
        name: "Ondojo",
        color: null,
      },
    ],
  },
];

describe("TrackerTimerBar", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders a sticky timer bar with description, project, live counter, and start control when idle", () => {
    render(
      <TrackerTimerBar
        running={null}
        liveCounter="0:00:00"
        description=""
        projectId=""
        projectGroups={projectGroups}
        saving={false}
        startedAt=""
        endedAt=""
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStartedAtChange={vi.fn()}
        onEndedAtChange={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onAddManual={vi.fn()}
      />,
    );

    const bar = screen.getByRole("region", { name: /timer bar/i });
    expect(bar.className).toMatch(/sticky/);
    expect(bar.className).toMatch(/rounded-lg/);
    expect(bar.className).toMatch(/border/);
    expect(screen.getByLabelText(/^description$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^description$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^description$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/project \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByText("0:00:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start timer/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /stop timer/i })).not.toBeInTheDocument();
  });

  it("shows empty Start and End as times below the live counter; date only via calendar (defaults to today)", () => {
    const today = localDateValue(new Date());
    render(
      <TrackerTimerBar
        running={null}
        liveCounter="0:00:00"
        description=""
        projectId=""
        projectGroups={projectGroups}
        saving={false}
        startedAt=""
        endedAt=""
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStartedAtChange={vi.fn()}
        onEndedAtChange={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onAddManual={vi.fn()}
      />,
    );

    const startField = screen.getByLabelText(/^start$/i);
    const endField = screen.getByLabelText(/^end$/i);
    expect(startField).toHaveAttribute("type", "time");
    expect(endField).toHaveAttribute("type", "time");
    expect(startField).toHaveValue("");
    expect(endField).toHaveValue("");
    expect(screen.queryByLabelText(/^date$/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: new RegExp(`^change date: ${today}$`, "i") }),
    ).toHaveAttribute("title", today);

    const counter = screen.getByText("0:00:00");
    const startButton = screen.getByRole("button", { name: /start timer/i });
    expect(
      counter.compareDocumentPosition(startField) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      startButton.compareDocumentPosition(startField) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("sticks the timer bar just below the header band", () => {
    render(
      <TrackerTimerBar
        running={null}
        liveCounter="0:00:00"
        description=""
        projectId=""
        projectGroups={projectGroups}
        saving={false}
        startedAt=""
        endedAt=""
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStartedAtChange={vi.fn()}
        onEndedAtChange={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onAddManual={vi.fn()}
      />,
    );

    const bar = screen.getByRole("region", { name: /timer bar/i });
    expect(bar.className).toMatch(/sticky/);
    expect(bar.className).toMatch(/(?:^|\s)top-0(?:\s|$)/);
    expect(bar.className).toMatch(/md:top-14/);
    expect(bar.className).toMatch(/z-10/);
  });

  it("keeps project select and live counter in separate non-overlapping regions", () => {
    render(
      <TrackerTimerBar
        running={null}
        liveCounter="0:00:00"
        description="Past planning session"
        projectId=""
        projectGroups={projectGroups}
        saving={false}
        startedAt=""
        endedAt=""
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStartedAtChange={vi.fn()}
        onEndedAtChange={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onAddManual={vi.fn()}
      />,
    );

    const projectSelect = screen.getByLabelText(/project \(optional\)/i);
    const projectField = projectSelect.closest("label");
    const counter = screen.getByText("0:00:00");
    const counterRegion = counter.parentElement;

    expect(projectField?.className).toMatch(/shrink-0/);
    expect(projectField?.className).not.toMatch(/min-w-0/);
    expect(projectSelect.className).toMatch(/w-full/);
    expect(counterRegion?.className).toMatch(/shrink-0/);
    expect(projectField).not.toBe(counterRegion);
  });

  it("shows stop control and groups projects under their client when running", () => {
    render(
      <TrackerTimerBar
        running={{
          id: "e1",
          projectId: "p1",
          startedAt: "2026-07-02T08:00:00.000Z",
          endedAt: null,
          description: "Design review",
          tags: [],
          billable: true,
          amount: null,
          billableComplete: false,
          isRunning: true,
          durationMinutes: 1,
          invoiced: false,
          locked: false,
        }}
        liveCounter="0:01:05"
        description="Design review"
        projectId="p1"
        projectGroups={projectGroups}
        saving={false}
        startedAt=""
        endedAt=""
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStartedAtChange={vi.fn()}
        onEndedAtChange={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onAddManual={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /stop timer/i })).toBeInTheDocument();
    expect(screen.getByText("0:01:05")).toHaveClass("tabular-nums");
    expect(screen.getByRole("group", { name: "Bandao" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ondojo" })).toBeInTheDocument();
  });

  it("calls onStart when the start button is clicked", () => {
    const onStart = vi.fn();
    render(
      <TrackerTimerBar
        running={null}
        liveCounter="0:00:00"
        description=""
        projectId=""
        projectGroups={[]}
        saving={false}
        startedAt=""
        endedAt=""
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStartedAtChange={vi.fn()}
        onEndedAtChange={vi.fn()}
        onStart={onStart}
        onStop={vi.fn()}
        onAddManual={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /start timer/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("disables Start and End fields while saving", () => {
    render(
      <TrackerTimerBar
        running={null}
        liveCounter="0:00:00"
        description=""
        projectId=""
        projectGroups={[]}
        saving={true}
        startedAt=""
        endedAt=""
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStartedAtChange={vi.fn()}
        onEndedAtChange={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onAddManual={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^start$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^end$/i)).toBeDisabled();
  });

  it("replaces Start timer with Add entry when both Start and End are set", () => {
    const onAddManual = vi.fn();
    const onStart = vi.fn();
    render(
      <TrackerTimerBar
        running={null}
        liveCounter="0:00:00"
        description="Backfill"
        projectId=""
        projectGroups={[]}
        saving={false}
        startedAt="2026-07-02T08:00"
        endedAt="2026-07-02T09:00"
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStartedAtChange={vi.fn()}
        onEndedAtChange={vi.fn()}
        onStart={onStart}
        onStop={vi.fn()}
        onAddManual={onAddManual}
      />,
    );

    expect(screen.queryByRole("button", { name: /start timer/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));
    expect(onAddManual).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("emits local datetimes for time edits using the calendar date (today when empty)", () => {
    const today = localDateValue(new Date());
    const onStartedAtChange = vi.fn();
    const onEndedAtChange = vi.fn();
    const props = {
      running: null,
      liveCounter: "0:00:00",
      description: "",
      projectId: "",
      projectGroups: [] as ProjectClientGroup[],
      saving: false,
      startedAt: "",
      endedAt: "",
      onDescriptionChange: vi.fn(),
      onDescriptionSuggestionSelect: vi.fn(),
      onProjectChange: vi.fn(),
      onStartedAtChange,
      onEndedAtChange,
      onStart: vi.fn(),
      onStop: vi.fn(),
      onAddManual: vi.fn(),
    };
    const { rerender } = render(<TrackerTimerBar {...props} />);

    fireEvent.change(screen.getByLabelText(/^start$/i), {
      target: { value: "08:00" },
    });
    expect(onStartedAtChange).toHaveBeenCalledWith(`${today}T08:00`);
    expect(onEndedAtChange).not.toHaveBeenCalled();

    rerender(
      <TrackerTimerBar {...props} startedAt={`${today}T08:00`} endedAt="" />,
    );
    fireEvent.change(screen.getByLabelText(/^end$/i), {
      target: { value: "09:30" },
    });
    expect(onEndedAtChange).toHaveBeenCalledWith(`${today}T09:30`);
  });

  it("applies calendar icon date to both times when the shared day changes", () => {
    const onStartedAtChange = vi.fn();
    const onEndedAtChange = vi.fn();
    render(
      <TrackerTimerBar
        running={null}
        liveCounter="0:00:00"
        description=""
        projectId=""
        projectGroups={[]}
        saving={false}
        startedAt="2026-07-02T22:00"
        endedAt="2026-07-03T02:00"
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStartedAtChange={onStartedAtChange}
        onEndedAtChange={onEndedAtChange}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onAddManual={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^change date: 2026-07-02$/i }),
    );
    fireEvent.change(screen.getByLabelText(/^date$/i), {
      target: { value: "2026-07-05" },
    });

    expect(onStartedAtChange).toHaveBeenCalledWith("2026-07-05T22:00");
    expect(onEndedAtChange).toHaveBeenCalledWith("2026-07-06T02:00");
  });

  it("resets calendar day to today after parent clears Start and End", () => {
    const today = localDateValue(new Date());
    const onStartedAtChange = vi.fn();
    const props = {
      running: null,
      liveCounter: "0:00:00",
      description: "",
      projectId: "",
      projectGroups: [] as ProjectClientGroup[],
      saving: false,
      onDescriptionChange: vi.fn(),
      onDescriptionSuggestionSelect: vi.fn(),
      onProjectChange: vi.fn(),
      onStartedAtChange,
      onEndedAtChange: vi.fn(),
      onStart: vi.fn(),
      onStop: vi.fn(),
      onAddManual: vi.fn(),
    };
    const { rerender } = render(
      <TrackerTimerBar
        {...props}
        startedAt="2026-07-02T08:00"
        endedAt="2026-07-02T09:00"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^change date: 2026-07-02$/i }),
    );
    const dateInput = screen.getByLabelText(/^date$/i);
    fireEvent.change(dateInput, {
      target: { value: "2026-07-05" },
    });
    fireEvent.blur(dateInput);

    rerender(<TrackerTimerBar {...props} startedAt="" endedAt="" />);

    expect(
      screen.getByRole("button", { name: new RegExp(`^change date: ${today}$`, "i") }),
    ).toHaveAttribute("title", today);

    fireEvent.change(screen.getByLabelText(/^start$/i), {
      target: { value: "10:00" },
    });
    expect(onStartedAtChange).toHaveBeenLastCalledWith(`${today}T10:00`);
  });

  it("keeps a calendar-only day pick while Start and End stay empty", () => {
    const onStartedAtChange = vi.fn();
    const today = localDateValue(new Date());
    render(
      <TrackerTimerBar
        running={null}
        liveCounter="0:00:00"
        description=""
        projectId=""
        projectGroups={[]}
        saving={false}
        startedAt=""
        endedAt=""
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStartedAtChange={onStartedAtChange}
        onEndedAtChange={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onAddManual={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`^change date: ${today}$`, "i") }),
    );
    const dateInput = screen.getByLabelText(/^date$/i);
    fireEvent.change(dateInput, {
      target: { value: "2026-07-05" },
    });
    fireEvent.blur(dateInput);

    expect(
      screen.getByRole("button", { name: /^change date: 2026-07-05$/i }),
    ).toHaveAttribute("title", "2026-07-05");

    fireEvent.change(screen.getByLabelText(/^start$/i), {
      target: { value: "08:00" },
    });
    expect(onStartedAtChange).toHaveBeenCalledWith("2026-07-05T08:00");
  });
});
