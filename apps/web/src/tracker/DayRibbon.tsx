import {
  layoutDayRibbon,
  layoutDayRibbonGaps,
  normalizeDragRange,
  nudgeInstantMs,
  ribbonFractionToMs,
  snapInstantMs,
  DAY_RIBBON_SNAP_MINUTES,
} from "@hourden/domain";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type { ProjectClientGroup } from "./groupProjectsByClient.js";
import {
  DayRibbonCreatePopover,
  type DayRibbonCreateDraft,
} from "./DayRibbonCreatePopover.js";

export type DayRibbonEntry = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
  projectName: string | null;
  projectColor: string | null;
  locked?: boolean;
};

export type DayRibbonCreateInput = {
  startedAt: string;
  endedAt: string;
  description: string;
  projectId: string | null;
};

export type DayRibbonResizeInput = {
  entryId: string;
  startedAt?: string;
  endedAt?: string;
};

type DayRibbonProps = {
  dateKey: string;
  timeZone: string;
  entries: DayRibbonEntry[];
  /** Wall clock for Running Timer end; defaults to now. */
  now?: Date;
  formatTime: (iso: string) => string;
  onSelectEntry: (entryId: string) => void;
  projectGroups?: ProjectClientGroup[];
  onCreateEntry?: (input: DayRibbonCreateInput) => Promise<void>;
  onResizeEntry?: (input: DayRibbonResizeInput) => Promise<void>;
};

type PaintDrag = {
  kind: "paint";
  originMs: number;
  currentMs: number;
  snap: boolean;
  pointerId: number;
};

type ResizeDrag = {
  kind: "resize";
  entryId: string;
  edge: "start" | "end";
  originStartMs: number;
  originEndMs: number;
  currentMs: number;
  snap: boolean;
  pointerId: number;
};

type ActiveDrag = PaintDrag | ResizeDrag;

const TOUCH_LONG_PRESS_MS = 400;
const MIN_RANGE_MS = DAY_RIBBON_SNAP_MINUTES * 60_000;

function fractionFromClientX(
  clientX: number,
  track: HTMLElement,
): number {
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  return (clientX - rect.left) / rect.width;
}

function clampResize(
  edge: "start" | "end",
  nextMs: number,
  startMs: number,
  endMs: number,
): number {
  if (edge === "start") {
    return Math.min(nextMs, endMs - MIN_RANGE_MS);
  }
  return Math.max(nextMs, startMs + MIN_RANGE_MS);
}

export function DayRibbon({
  dateKey,
  timeZone,
  entries,
  now,
  formatTime,
  onSelectEntry,
  projectGroups = [],
  onCreateEntry,
  onResizeEntry,
}: DayRibbonProps) {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchArmedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<ActiveDrag | null>(null);
  const detachDragRef = useRef<(() => void) | null>(null);
  const msFromPointerRef = useRef<(clientX: number, snap: boolean) => number>(
    () => 0,
  );
  const finishDragRef = useRef<(active: ActiveDrag) => void>(() => undefined);

  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const [createDraft, setCreateDraft] = useState<DayRibbonCreateDraft | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const layout = layoutDayRibbon(
    dateKey,
    entries.map((entry) => ({
      id: entry.id,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
    })),
    { timeZone, now },
  );
  const gaps = layoutDayRibbonGaps(layout);
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const interactive = Boolean(onCreateEntry || onResizeEntry);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openCreate = useCallback(
    (startMs: number, endMs: number) => {
      if (!onCreateEntry) return;
      const range = normalizeDragRange(startMs, endMs);
      if (range.endMs - range.startMs < MIN_RANGE_MS) return;
      setCreateDraft({
        startedAt: new Date(range.startMs).toISOString(),
        endedAt: new Date(range.endMs).toISOString(),
        startLabel: formatTime(new Date(range.startMs).toISOString()),
        endLabel: formatTime(new Date(range.endMs).toISOString()),
      });
      setDescription("");
      setProjectId("");
      setCreateError(null);
    },
    [formatTime, onCreateEntry],
  );

  const cancelCreate = () => {
    setCreateDraft(null);
    setDescription("");
    setProjectId("");
    setCreateError(null);
  };

  const submitCreate = async () => {
    if (!createDraft || !onCreateEntry) return;
    setSaving(true);
    setCreateError(null);
    try {
      await onCreateEntry({
        startedAt: createDraft.startedAt,
        endedAt: createDraft.endedAt,
        description: description.trim(),
        projectId: projectId || null,
      });
      cancelCreate();
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : t("tracker.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const msFromPointer = useCallback(
    (clientX: number, snap: boolean) => {
      const track = trackRef.current;
      if (!track) return layout.windowStartMs;
      const raw = ribbonFractionToMs(
        fractionFromClientX(clientX, track),
        layout.windowStartMs,
        layout.windowEndMs,
      );
      return snapInstantMs(raw, { snap });
    },
    [layout.windowEndMs, layout.windowStartMs],
  );
  msFromPointerRef.current = msFromPointer;

  const finishDrag = useCallback(
    async (active: ActiveDrag) => {
      if (active.kind === "paint") {
        openCreate(active.originMs, active.currentMs);
        return;
      }
      if (!onResizeEntry) return;
      const next = clampResize(
        active.edge,
        active.currentMs,
        active.originStartMs,
        active.originEndMs,
      );
      if (!Number.isFinite(next)) return;
      const patch: DayRibbonResizeInput = { entryId: active.entryId };
      if (active.edge === "start") {
        if (next === active.originStartMs) return;
        patch.startedAt = new Date(next).toISOString();
      } else {
        if (next === active.originEndMs) return;
        patch.endedAt = new Date(next).toISOString();
      }
      try {
        await onResizeEntry(patch);
      } catch {
        // Parent surfaces API errors.
      }
    },
    [onResizeEntry, openCreate],
  );
  finishDragRef.current = (active) => {
    void finishDrag(active);
  };

  const detachDragListeners = useCallback(() => {
    detachDragRef.current?.();
    detachDragRef.current = null;
  }, []);

  const attachDragListeners = useCallback(() => {
    detachDragListeners();

    const onMove = (event: PointerEvent) => {
      const active = dragRef.current;
      if (!active || event.pointerId !== active.pointerId) return;
      const snap = active.snap && !event.altKey;
      const nextMs = msFromPointerRef.current(event.clientX, snap);
      if (!Number.isFinite(nextMs)) return;
      const next = { ...active, currentMs: nextMs, snap };
      dragRef.current = next;
      setDrag(next);
    };

    const onUp = (event: PointerEvent) => {
      const active = dragRef.current;
      if (!active || event.pointerId !== active.pointerId) return;
      const snap = active.snap && !event.altKey;
      const finalMs = msFromPointerRef.current(event.clientX, snap);
      detachDragListeners();
      dragRef.current = null;
      setDrag(null);
      if (!Number.isFinite(finalMs)) {
        suppressClickRef.current = false;
        return;
      }
      finishDragRef.current({ ...active, currentMs: finalMs, snap });
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      detachDragListeners();
      dragRef.current = null;
      setDrag(null);
      suppressClickRef.current = false;
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("keydown", onKey);
    detachDragRef.current = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("keydown", onKey);
    };
  }, [detachDragListeners]);

  const beginPaint = useCallback(
    (clientX: number, pointerId: number, snap: boolean) => {
      if (!onCreateEntry) return;
      const originMs = msFromPointer(clientX, snap);
      const next: PaintDrag = {
        kind: "paint",
        originMs,
        currentMs: originMs,
        snap,
        pointerId,
      };
      dragRef.current = next;
      setDrag(next);
      suppressClickRef.current = true;
      attachDragListeners();
    },
    [attachDragListeners, msFromPointer, onCreateEntry],
  );

  const beginResize = useCallback(
    (
      entryId: string,
      edge: "start" | "end",
      clientX: number,
      pointerId: number,
      snap: boolean,
      originStartMs: number,
      originEndMs: number,
    ) => {
      if (!onResizeEntry) return;
      const next: ResizeDrag = {
        kind: "resize",
        entryId,
        edge,
        originStartMs,
        originEndMs,
        currentMs: msFromPointer(clientX, snap),
        snap,
        pointerId,
      };
      dragRef.current = next;
      setDrag(next);
      suppressClickRef.current = true;
      attachDragListeners();
    },
    [attachDragListeners, msFromPointer, onResizeEntry],
  );

  useEffect(
    () => () => {
      clearLongPress();
      detachDragListeners();
    },
    [detachDragListeners],
  );

  useEffect(() => {
    if (!createDraft) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelCreate();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [createDraft]);

  const previewRange =
    drag?.kind === "paint"
      ? normalizeDragRange(drag.originMs, drag.currentMs)
      : null;

  const resizePreview =
    drag?.kind === "resize"
      ? (() => {
          const next = clampResize(
            drag.edge,
            drag.currentMs,
            drag.originStartMs,
            drag.originEndMs,
          );
          return drag.edge === "start"
            ? { startMs: next, endMs: drag.originEndMs }
            : { startMs: drag.originStartMs, endMs: next };
        })()
      : null;

  const span = layout.windowEndMs - layout.windowStartMs;
  const pct = (ms: number) =>
    span === 0 ? 0 : ((ms - layout.windowStartMs) / span) * 100;

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || !onCreateEntry || event.button !== 0) return;
    const target = event.target as HTMLElement;
    // Gaps use pointer-events-none so paint hits the track; blocks/handles stop it.
    if (target.closest("[data-entry-block], [data-resize-handle]")) {
      return;
    }

    const snap = !event.altKey;
    if (event.pointerType === "touch") {
      touchArmedRef.current = false;
      clearLongPress();
      const { clientX, pointerId } = event;
      longPressTimerRef.current = setTimeout(() => {
        touchArmedRef.current = true;
        beginPaint(clientX, pointerId, snap);
      }, TOUCH_LONG_PRESS_MS);
      return;
    }

    beginPaint(event.clientX, event.pointerId, snap);
  };

  const onTrackPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    if (longPressTimerRef.current !== null && !touchArmedRef.current) {
      // Finger moved before long-press armed — treat as scroll, cancel paint.
      clearLongPress();
    }
  };

  const onTrackPointerUp = () => {
    clearLongPress();
  };

  return (
    <div className="relative mt-2">
      <div
        ref={trackRef}
        className={`relative h-3 w-full min-w-0 overflow-hidden rounded-sm bg-surface-hover${
          drag ? " touch-none" : ""
        }`}
        data-day-ribbon={dateKey}
        role="group"
        aria-label={t("tracker.dayRibbon", { date: dateKey })}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerCancel={onTrackPointerUp}
      >
        {interactive &&
          gaps.map((gap) => {
            const startLabel = formatTime(new Date(gap.startMs).toISOString());
            const endLabel = formatTime(new Date(gap.endMs).toISOString());
            return (
              <button
                key={gap.id}
                type="button"
                data-gap={gap.id}
                tabIndex={0}
                aria-label={t("tracker.dayRibbonGap", {
                  start: startLabel,
                  end: endLabel,
                })}
                className="pointer-events-none absolute top-0 z-0 h-full cursor-text border-0 bg-transparent p-0"
                style={{
                  left: `${gap.leftPct}%`,
                  width: `${gap.widthPct}%`,
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCreate(gap.startMs, gap.endMs);
                  }
                }}
              />
            );
          })}

        {layout.blocks.map((block) => {
          const entry = entryById.get(block.id);
          if (!entry) return null;

          const descriptionLabel =
            entry.description?.trim() || t("tracker.noDescription");
          const project = entry.projectName ?? t("tracker.noProject");
          const startLabel = formatTime(
            new Date(block.clippedStartMs).toISOString(),
          );
          const endLabel = block.isRunning
            ? t("tracker.running")
            : formatTime(new Date(block.clippedEndMs).toISOString());
          const label = t("tracker.dayRibbonBlock", {
            description: descriptionLabel,
            project,
            start: startLabel,
            end: endLabel,
          });
          const frozen = Boolean(entry.locked) || block.isRunning;
          const showHandles = interactive && onResizeEntry && !frozen;

          const preview =
            resizePreview && drag?.kind === "resize" && drag.entryId === block.id
              ? resizePreview
              : null;
          const leftPct = preview ? pct(preview.startMs) : block.leftPct;
          const widthPct = preview
            ? pct(preview.endMs) - pct(preview.startMs)
            : block.widthPct;

          const activate = () => {
            if (suppressClickRef.current) return;
            onSelectEntry(block.id);
          };

          return (
            <div
              key={block.id}
              className="absolute top-0 z-[1] h-full"
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            >
              <button
                type="button"
                tabIndex={0}
                title={label}
                aria-label={label}
                data-running={block.isRunning ? "true" : undefined}
                data-entry-block={block.id}
                className={`absolute inset-0 min-w-[2px] rounded-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus${
                  block.isRunning ? " bg-primary" : ""
                }${frozen ? " cursor-not-allowed" : ""}`}
                style={
                  block.isRunning
                    ? undefined
                    : {
                        backgroundColor:
                          entry.projectColor ?? "var(--color-muted)",
                        opacity: entry.projectColor ? 1 : 0.45,
                      }
                }
                onClick={activate}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activate();
                  }
                }}
              />
              {showHandles ? (
                <>
                  <ResizeHandle
                    edge="start"
                    label={t("tracker.dayRibbonResizeStart", {
                      description: descriptionLabel,
                    })}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      const snap = !event.altKey;
                      if (event.pointerType === "touch") {
                        clearLongPress();
                        const { clientX, pointerId } = event;
                        longPressTimerRef.current = setTimeout(() => {
                          beginResize(
                            block.id,
                            "start",
                            clientX,
                            pointerId,
                            snap,
                            block.clippedStartMs,
                            block.clippedEndMs,
                          );
                        }, TOUCH_LONG_PRESS_MS);
                        return;
                      }
                      beginResize(
                        block.id,
                        "start",
                        event.clientX,
                        event.pointerId,
                        snap,
                        block.clippedStartMs,
                        block.clippedEndMs,
                      );
                    }}
                    onKeyNudge={async (direction) => {
                      if (!onResizeEntry) return;
                      const next = clampResize(
                        "start",
                        nudgeInstantMs(block.clippedStartMs, direction),
                        block.clippedStartMs,
                        block.clippedEndMs,
                      );
                      if (next === block.clippedStartMs) return;
                      await onResizeEntry({
                        entryId: block.id,
                        startedAt: new Date(next).toISOString(),
                      });
                    }}
                  />
                  <ResizeHandle
                    edge="end"
                    label={t("tracker.dayRibbonResizeEnd", {
                      description: descriptionLabel,
                    })}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      const snap = !event.altKey;
                      if (event.pointerType === "touch") {
                        clearLongPress();
                        const { clientX, pointerId } = event;
                        longPressTimerRef.current = setTimeout(() => {
                          beginResize(
                            block.id,
                            "end",
                            clientX,
                            pointerId,
                            snap,
                            block.clippedStartMs,
                            block.clippedEndMs,
                          );
                        }, TOUCH_LONG_PRESS_MS);
                        return;
                      }
                      beginResize(
                        block.id,
                        "end",
                        event.clientX,
                        event.pointerId,
                        snap,
                        block.clippedStartMs,
                        block.clippedEndMs,
                      );
                    }}
                    onKeyNudge={async (direction) => {
                      if (!onResizeEntry) return;
                      const next = clampResize(
                        "end",
                        nudgeInstantMs(block.clippedEndMs, direction),
                        block.clippedStartMs,
                        block.clippedEndMs,
                      );
                      if (next === block.clippedEndMs) return;
                      await onResizeEntry({
                        entryId: block.id,
                        endedAt: new Date(next).toISOString(),
                      });
                    }}
                  />
                </>
              ) : null}
            </div>
          );
        })}

        {previewRange && previewRange.endMs > previewRange.startMs ? (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 z-[2] h-full rounded-[1px] bg-primary/40"
            style={{
              left: `${pct(previewRange.startMs)}%`,
              width: `${pct(previewRange.endMs) - pct(previewRange.startMs)}%`,
            }}
          />
        ) : null}
      </div>

      {createDraft ? (
        <DayRibbonCreatePopover
          draft={createDraft}
          projectGroups={projectGroups}
          description={description}
          projectId={projectId}
          saving={saving}
          error={createError}
          onDescriptionChange={setDescription}
          onProjectIdChange={setProjectId}
          onSuggestionSelect={(suggestion) => {
            setDescription(suggestion.description);
            setProjectId(suggestion.projectId ?? "");
          }}
          onSubmit={() => {
            void submitCreate();
          }}
          onCancel={cancelCreate}
        />
      ) : null}
    </div>
  );
}

function ResizeHandle({
  edge,
  label,
  onPointerDown,
  onKeyNudge,
}: {
  edge: "start" | "end";
  label: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyNudge: (direction: 1 | -1) => void | Promise<void>;
}) {
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={edge === "start" ? 0 : 100}
      data-resize-handle={edge}
      className={`absolute top-0 z-[3] h-full w-2 -translate-x-1/2 cursor-ew-resize touch-none bg-transparent ${
        edge === "start" ? "left-0" : "left-full"
      }`}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          void onKeyNudge(-1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          void onKeyNudge(1);
        }
      }}
    />
  );
}
