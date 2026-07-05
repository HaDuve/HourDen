import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "../i18n/i18n.js";
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
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
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
        }}
        liveCounter="0:01:05"
        description="Design review"
        projectId="p1"
        projectGroups={projectGroups}
        saving={false}
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
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
        onDescriptionChange={vi.fn()}
        onDescriptionSuggestionSelect={vi.fn()}
        onProjectChange={vi.fn()}
        onStart={onStart}
        onStop={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /start timer/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
