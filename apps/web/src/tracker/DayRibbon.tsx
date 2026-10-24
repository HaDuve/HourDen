import { layoutDayRibbon } from "@hourden/domain";
import { useTranslation } from "react-i18next";

export type DayRibbonEntry = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
  projectName: string | null;
  projectColor: string | null;
};

type DayRibbonProps = {
  dateKey: string;
  timeZone: string;
  entries: DayRibbonEntry[];
  /** Wall clock for Running Timer end; defaults to now. */
  now?: Date;
  formatTime: (iso: string) => string;
  onSelectEntry: (entryId: string) => void;
};

export function DayRibbon({
  dateKey,
  timeZone,
  entries,
  now,
  formatTime,
  onSelectEntry,
}: DayRibbonProps) {
  const { t } = useTranslation();
  const layout = layoutDayRibbon(
    dateKey,
    entries.map((entry) => ({
      id: entry.id,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
    })),
    { timeZone, now },
  );

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

  return (
    <div
      className="relative mt-2 h-3 w-full min-w-0 overflow-hidden rounded-sm bg-surface-hover"
      data-day-ribbon={dateKey}
      role="group"
      aria-label={t("tracker.dayRibbon", { date: dateKey })}
    >
      {layout.blocks.map((block) => {
        const entry = entryById.get(block.id);
        if (!entry) return null;

        const description =
          entry.description?.trim() || t("tracker.noDescription");
        const project = entry.projectName ?? t("tracker.noProject");
        const startLabel = formatTime(
          new Date(block.clippedStartMs).toISOString(),
        );
        const endLabel = block.isRunning
          ? t("tracker.running")
          : formatTime(new Date(block.clippedEndMs).toISOString());
        const label = t("tracker.dayRibbonBlock", {
          description,
          project,
          start: startLabel,
          end: endLabel,
        });

        const activate = () => onSelectEntry(block.id);

        return (
          <button
            key={block.id}
            type="button"
            tabIndex={0}
            title={label}
            aria-label={label}
            data-running={block.isRunning ? "true" : undefined}
            data-entry-block={block.id}
            className={`absolute top-0 h-full min-w-[2px] rounded-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus${
              block.isRunning ? " bg-primary" : ""
            }`}
            style={{
              left: `${block.leftPct}%`,
              width: `${block.widthPct}%`,
              ...(block.isRunning
                ? {}
                : {
                    backgroundColor: entry.projectColor ?? "var(--color-muted)",
                    opacity: entry.projectColor ? 1 : 0.45,
                  }),
            }}
            onClick={activate}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activate();
              }
            }}
          />
        );
      })}
    </div>
  );
}
