import { metaTextClass } from "../layout/ui-classes.js";

const ROW_COUNT = 4;

/** List-shaped placeholder while Tracker entries load. */
export function TrackerListSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="space-y-6"
      data-testid="tracker-list-skeleton"
    >
      <span className="sr-only">{label}</span>
      <div className="space-y-2 px-1">
        <div className="h-4 w-28 animate-pulse rounded bg-surface-hover" />
        <div className={`h-3 w-20 animate-pulse rounded bg-surface-hover ${metaTextClass}`} />
      </div>
      <ul className="divide-y divide-divider">
        {Array.from({ length: ROW_COUNT }, (_, index) => (
          <li key={index} className="flex items-start justify-between gap-3 px-4 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-3/5 max-w-xs animate-pulse rounded bg-surface-hover" />
              <div className="h-3 w-2/5 max-w-[12rem] animate-pulse rounded bg-surface-hover" />
            </div>
            <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-surface-hover" />
          </li>
        ))}
      </ul>
    </div>
  );
}
