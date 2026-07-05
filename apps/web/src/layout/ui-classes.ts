/** Semantic Tailwind class strings (ADR-0012). Screens use these, not raw palette utilities. */

export const pageTitleClass = "text-2xl font-semibold text-content";
export const pageTitleLargeClass = "text-3xl font-semibold tracking-tight text-content";
export const pageSubtitleClass = "text-sm text-muted";
export const bodyTextClass = "text-sm text-content";
export const metaTextClass = "text-sm text-muted";
export const fieldLabelClass = "text-sm font-medium text-content";
export const fieldLabelMutedClass = "text-sm text-muted";

export const inputClass =
  "rounded-md border border-input bg-input px-3 py-2 text-sm text-content";
export const inputClassMobile =
  "min-h-11 w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-content";
export const selectClass = inputClass;

export const cardClass = "rounded-lg border border-divider bg-surface";
export const panelClass = "rounded-lg border border-divider bg-surface p-4";
export const listPanelClass =
  "divide-y divide-divider overflow-hidden rounded-lg border border-divider bg-surface";
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
  "cursor-not-allowed rounded-md border border-divider text-muted opacity-60";

export const errorBannerClass =
  "rounded-lg border border-destructive-border bg-destructive-muted px-4 py-3 text-sm text-danger";
export const infoPanelClass =
  "rounded-md border border-divider bg-surface px-4 py-3 text-sm text-content";

export const accentInputClass =
  "rounded-md border border-accent-border bg-accent-muted px-3 py-2 text-sm text-content";

/** Duration, amounts, rates — monospaced and right-aligned per ADR-0012. */
export const numericValueClass = "font-mono tabular-nums text-right text-content";
export const numericMetaValueClass = "font-mono tabular-nums text-right text-muted";
export const numericHeaderClass = "text-right font-medium";
