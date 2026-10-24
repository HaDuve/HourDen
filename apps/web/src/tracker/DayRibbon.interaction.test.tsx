import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import i18n from "../i18n/i18n.js";
import { DayRibbon } from "./DayRibbon.js";
import type { ProjectClientGroup } from "./groupProjectsByClient.js";

const morning = {
  id: "e0000000-0000-4000-8000-000000000001",
  startedAt: "2026-07-02T10:00:00.000Z",
  endedAt: "2026-07-02T12:00:00.000Z",
  description: "Morning work",
  projectName: "Acme",
  projectColor: "#3b82f6",
  locked: false,
};

const projectGroups: ProjectClientGroup[] = [
  {
    clientId: "c1",
    clientName: "Acme Co",
    projects: [
      {
        id: "p1",
        clientId: "c1",
        name: "Acme",
        color: "#3b82f6",
      },
    ],
  },
];

/** Ribbon track is 1000px wide at x=0 so clientX maps 1:1 to percent. */
function mockRibbonBounds() {
  return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 12,
    right: 1000,
    width: 1000,
    height: 12,
    toJSON: () => ({}),
  } as DOMRect);
}

function renderRibbon(
  overrides: Partial<ComponentProps<typeof DayRibbon>> = {},
) {
  const onCreateEntry = vi.fn().mockResolvedValue(undefined);
  const onResizeEntry = vi.fn().mockResolvedValue(undefined);
  const props = {
    dateKey: "2026-07-02",
    timeZone: "UTC",
    entries: [morning],
    formatTime: (iso: string) => {
      const d = new Date(iso);
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    },
    onSelectEntry: vi.fn(),
    projectGroups,
    onCreateEntry,
    onResizeEntry,
    ...overrides,
  };
  const result = render(<DayRibbon {...props} />);
  return { ...result, onCreateEntry, onResizeEntry, props };
}

describe("DayRibbon paint and resize", () => {
  let boundsSpy: ReturnType<typeof mockRibbonBounds>;

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    boundsSpy = mockRibbonBounds();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ suggestions: [] }),
      }),
    );
  });

  afterEach(() => {
    boundsSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("opens a create popover with snapped times after dragging a gap", async () => {
    const { onCreateEntry } = renderRibbon();
    const track = screen.getByRole("group", { name: /Day ribbon for 2026-07-02/i });

    // Default window 08:00–18:00; 50%→13:00, 60%→14:00
    fireEvent.pointerDown(track, { clientX: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(track, { clientX: 600, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 600, pointerId: 1 });

    const dialog = await screen.findByRole("dialog", { name: /Manual entry/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText(/^Start$/i)).toHaveValue("13:00");
    expect(screen.getByLabelText(/^End$/i)).toHaveValue("14:00");

    fireEvent.change(screen.getByLabelText(/^Description$/i), {
      target: { value: "Painted work" },
    });
    fireEvent.submit(dialog.querySelector("form")!);

    await waitFor(() => {
      expect(onCreateEntry).toHaveBeenCalledWith({
        startedAt: "2026-07-02T13:00:00.000Z",
        endedAt: "2026-07-02T14:00:00.000Z",
        description: "Painted work",
        projectId: null,
      });
    });
  });

  it("resizes a block via its end edge and patches through onResizeEntry", async () => {
    const { onResizeEntry } = renderRibbon();
    const endHandle = screen.getByRole("slider", {
      name: /Resize end of Morning work/i,
    });

    fireEvent.pointerDown(endHandle, { clientX: 400, pointerId: 1, button: 0 });
    // 50% of 08–18 = 13:00
    fireEvent.pointerMove(document, { clientX: 500, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 500, pointerId: 1 });

    await waitFor(() => {
      expect(onResizeEntry).toHaveBeenCalledWith({
        entryId: morning.id,
        endedAt: "2026-07-02T13:00:00.000Z",
      });
    });
  });

  it("cancels an in-progress resize on Escape", async () => {
    const { onResizeEntry } = renderRibbon();
    const endHandle = screen.getByRole("slider", {
      name: /Resize end of Morning work/i,
    });

    fireEvent.pointerDown(endHandle, { clientX: 400, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 500, pointerId: 1 });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerUp(document, { clientX: 500, pointerId: 1 });

    expect(onResizeEntry).not.toHaveBeenCalled();
  });

  it("shows not-allowed cursor and omits resize handles for locked entries", () => {
    renderRibbon({
      entries: [{ ...morning, locked: true }],
    });

    const block = screen.getByRole("button", { name: /Morning work/i });
    expect(block.className).toMatch(/cursor-not-allowed/);
    expect(
      screen.queryByRole("slider", { name: /Resize end of Morning work/i }),
    ).toBeNull();
  });

  it("shows not-allowed cursor and omits resize handles for the Running Timer", () => {
    renderRibbon({
      entries: [
        {
          ...morning,
          endedAt: null,
          description: "Live task",
        },
      ],
      now: new Date("2026-07-02T11:30:00.000Z"),
    });

    const block = screen.getByRole("button", { name: /Live task/i });
    expect(block.className).toMatch(/cursor-not-allowed/);
    expect(
      screen.queryByRole("slider", { name: /Resize/i }),
    ).toBeNull();
  });

  it("opens the create popover from a focused gap with Enter", async () => {
    renderRibbon();
    const gap = screen.getByRole("button", { name: /Empty time 08:00–10:00/i });
    gap.focus();
    fireEvent.keyDown(gap, { key: "Enter" });

    const dialog = await screen.findByRole("dialog", { name: /Manual entry/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText(/^Start$/i)).toHaveValue("08:00");
    expect(screen.getByLabelText(/^End$/i)).toHaveValue("10:00");
  });

  it("nudges a focused end edge with arrow keys", async () => {
    const { onResizeEntry } = renderRibbon();
    const endHandle = screen.getByRole("slider", {
      name: /Resize end of Morning work/i,
    });
    endHandle.focus();
    fireEvent.keyDown(endHandle, { key: "ArrowRight" });

    await waitFor(() => {
      expect(onResizeEntry).toHaveBeenCalledWith({
        entryId: morning.id,
        endedAt: "2026-07-02T12:05:00.000Z",
      });
    });
  });

  it("shows a snapped time preview on hover", () => {
    renderRibbon();
    const track = screen.getByRole("group", { name: /Day ribbon for 2026-07-02/i });

    // 50% of 08–18 = 13:00
    fireEvent.pointerMove(track, {
      clientX: 500,
      pointerType: "mouse",
    });

    const preview = document.querySelector("[data-day-ribbon-time-preview]");
    expect(preview).toHaveTextContent("13:00");
    expect(document.querySelector("[data-day-ribbon-playhead]")).not.toBeNull();

    fireEvent.pointerLeave(track);
    expect(document.querySelector("[data-day-ribbon-time-preview]")).toBeNull();
  });

  it("shows a start–end time preview while painting a gap", () => {
    renderRibbon();
    const track = screen.getByRole("group", { name: /Day ribbon for 2026-07-02/i });

    fireEvent.pointerDown(track, {
      clientX: 500,
      pointerId: 1,
      button: 0,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(document, { clientX: 600, pointerId: 1 });

    const preview = document.querySelector("[data-day-ribbon-time-preview]");
    expect(preview).toHaveTextContent("13:00–14:00");
  });

  it("shows a start–end time preview while resizing a block", () => {
    renderRibbon();
    const endHandle = screen.getByRole("slider", {
      name: /Resize end of Morning work/i,
    });

    fireEvent.pointerDown(endHandle, {
      clientX: 400,
      pointerId: 1,
      button: 0,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(document, { clientX: 500, pointerId: 1 });

    const preview = document.querySelector("[data-day-ribbon-time-preview]");
    expect(preview).toHaveTextContent("10:00–13:00");
  });
});
