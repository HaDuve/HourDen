import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "../i18n/i18n.js";
import { DayRibbon } from "./DayRibbon.js";

const morning = {
  id: "e0000000-0000-4000-8000-000000000001",
  startedAt: "2026-07-02T10:00:00.000Z",
  endedAt: "2026-07-02T12:00:00.000Z",
  description: "Morning work",
  projectName: "Acme",
  projectColor: "#3b82f6",
};

const afternoon = {
  id: "e0000000-0000-4000-8000-000000000002",
  startedAt: "2026-07-02T14:00:00.000Z",
  endedAt: "2026-07-02T15:00:00.000Z",
  description: "Afternoon",
  projectName: null,
  projectColor: null,
};

describe("DayRibbon", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders a focusable block per entry with accessible label and project color", () => {
    render(
      <DayRibbon
        dateKey="2026-07-02"
        timeZone="UTC"
        entries={[morning, afternoon]}
        formatTime={(iso) =>
          iso === morning.startedAt
            ? "10:00"
            : iso === morning.endedAt
              ? "12:00"
              : iso === afternoon.startedAt
                ? "14:00"
                : "15:00"
        }
        onSelectEntry={() => undefined}
      />,
    );

    const morningBlock = screen.getByRole("button", {
      name: /Morning work, Acme, 10:00–12:00/,
    });
    expect(morningBlock).toHaveAttribute("tabindex", "0");
    expect(morningBlock).toHaveStyle({ backgroundColor: "#3b82f6" });
    const morningShell = morningBlock.parentElement as HTMLElement;
    expect(morningShell.style.left).toBe("20%");
    expect(morningShell.style.width).toBe("20%");

    expect(
      screen.getByRole("button", { name: /Afternoon, No project, 14:00–15:00/ }),
    ).toBeInTheDocument();
  });

  it("marks the running block with ember styling and extends it to now", () => {
    const running = {
      id: "e0000000-0000-4000-8000-000000000099",
      startedAt: "2026-07-02T10:00:00.000Z",
      endedAt: null as string | null,
      description: "Live task",
      projectName: "Acme",
      projectColor: "#3b82f6",
    };

    render(
      <DayRibbon
        dateKey="2026-07-02"
        timeZone="UTC"
        entries={[running]}
        now={new Date("2026-07-02T11:30:00.000Z")}
        formatTime={() => "10:00"}
        onSelectEntry={() => undefined}
      />,
    );

    const block = screen.getByRole("button", { name: /Live task/ });
    expect(block).toHaveAttribute("data-running", "true");
    expect(block.className).toMatch(/bg-primary/);
    expect((block.parentElement as HTMLElement).style.width).toBe("15%");
  });

  it("calls onSelectEntry on click and Enter", () => {
    const onSelectEntry = vi.fn();
    render(
      <DayRibbon
        dateKey="2026-07-02"
        timeZone="UTC"
        entries={[morning]}
        formatTime={() => "10:00"}
        onSelectEntry={onSelectEntry}
      />,
    );

    const block = screen.getByRole("button", { name: /Morning work/ });
    fireEvent.click(block);
    expect(onSelectEntry).toHaveBeenCalledWith(morning.id);

    fireEvent.keyDown(block, { key: "Enter" });
    expect(onSelectEntry).toHaveBeenCalledTimes(2);
  });
});
