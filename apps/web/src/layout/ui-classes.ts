/** Semantic Tailwind class strings (ADR-0012 tokens; ADR-0015 Warm Den surfaces). Screens use these, not raw palette utilities. */

/** One page-title size across primary screens (#186). */
export const pageTitleClass = "text-3xl font-semibold tracking-tight text-content";
/** Alias of pageTitleClass (kept for existing imports). */
export const pageTitleLargeClass = pageTitleClass;
export const pageSubtitleClass = "text-sm text-muted";
export const bodyTextClass = "text-sm text-content";
export const metaTextClass = "text-sm text-muted";
export const fieldLabelClass = "text-sm font-medium text-content";
export const fieldLabelMutedClass = "text-sm text-muted";

export const inputClass =
  "rounded-md border border-input-border bg-input px-3 py-2 text-sm text-content";
export const inputClassMobile =
  "min-h-11 w-full rounded-md border border-input-border bg-input px-3 py-2 text-sm text-content";
export const selectClass = inputClass;

/** True containers: overlays, login shell, invoice chrome — keep bordered surface. */
export const cardClass = "rounded-lg border border-divider bg-surface";
export const panelClass = "rounded-lg border border-divider bg-surface p-4";
/** KPI / ledger cells — hairlines via parent divide; no bordered box (ADR-0015). */
export const ledgerCellClass = "bg-transparent";
/** Entry lists — hairline rows on the page background (ADR-0015 fewer boxes). */
export const listPanelClass = "divide-y divide-divider";
export const emptyStateClass =
  "rounded-lg border border-dashed border-divider bg-surface px-4 py-8 text-center text-muted";

export const primaryButtonClass =
  "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-content hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass =
  "rounded-md border border-secondary-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-content hover:bg-secondary-hover disabled:opacity-50";
export const destructiveButtonClass =
  "rounded-md border border-destructive-border bg-destructive px-4 py-2 text-sm font-medium text-destructive-content hover:bg-destructive-hover disabled:opacity-50";
export const destructiveOutlineButtonClass =
  "rounded-md border border-destructive-border text-danger hover:bg-destructive-muted";
export const mutedOutlineButtonClass =
  "rounded-md border border-divider text-muted opacity-60";

export const errorBannerClass =
  "rounded-lg border border-destructive-border bg-destructive-muted px-4 py-3 text-sm text-danger";
export const infoPanelClass =
  "rounded-md border border-divider bg-surface px-4 py-3 text-sm text-content";

export const accentInputClass =
  "rounded-md border border-accent-border bg-accent-muted px-3 py-2 text-sm text-content";

/** Timer bar while Running Timer is active — ember border on the true container. */
export const runningTimerBarClass =
  "rounded-lg border border-accent-border bg-surface p-4 shadow-sm";

/** Live Counter digits — ember while the timer is running. */
export const liveCounterClass =
  "font-numeric tabular-nums text-right text-lg text-primary";

/** Duration, amounts, rates — self-hosted numeric face, tabular, right-aligned (ADR-0015). */
export const numericValueClass = "font-numeric tabular-nums text-right text-content";
export const numericMetaValueClass = "font-numeric tabular-nums text-right text-muted";
export const numericHeaderClass = "text-right font-medium";
