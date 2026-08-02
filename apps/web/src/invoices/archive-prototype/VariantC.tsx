import { useState } from "react";
import {
  errorBannerClass,
  metaTextClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../../layout/ui-classes.js";
import { fill, protoCopy } from "./copy.js";
import {
  FakeFilter,
  IssuedChrome,
  SimulateRow,
  StateDump,
} from "./VariantA.js";
import type { ArchivePrototypeModel } from "./types.js";

export const variantCName = "Issue-adjacent chip";

/**
 * Folder status lives next to Issue; outcomes as sticky bottom strip;
 * Clear buried in a ··· menu. Zip remains a text link under filters.
 */
export function VariantC(props: ArchivePrototypeModel) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-divider px-4 py-3">
        <span className="text-sm font-medium text-content">Page header actions (mock)</span>
        <div className="flex flex-wrap items-center gap-2">
          <FolderChip {...props} />
          <button type="button" className={secondaryButtonClass} disabled>
            Preview
          </button>
          <button type="button" className={primaryButtonClass} disabled>
            Issue Invoice
          </button>
        </div>
      </div>

      <SimulateRow {...props} />

      <IssuedChrome
        title="Issued Invoices"
        filters={
          <>
            <FakeFilter label="Export client" value={props.exportClientLabel} />
            <FakeFilter label="Export year" value={props.exportYearLabel} />
          </>
        }
        trailing={null}
      >
        <p className="mt-1">
          <button
            type="button"
            className="text-sm text-muted underline hover:text-content"
            onClick={props.onDownloadAll}
          >
            {protoCopy.downloadAll}
          </button>
        </p>
      </IssuedChrome>

      <StickyOutcomeStrip {...props} />
      <StateDump {...props} />
    </div>
  );
}

function FolderChip(props: ArchivePrototypeModel) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { folder } = props;

  if (folder.status === "unsupported") {
    return <span className={`text-xs ${metaTextClass}`}>Archive: Chrome/Edge only</span>;
  }

  if (folder.status === "unset") {
    return (
      <button type="button" className={secondaryButtonClass} onClick={props.onChooseFolder}>
        {protoCopy.chooseFolder}
      </button>
    );
  }

  return (
    <div className="relative flex items-center gap-1">
      <span className="rounded-md border border-divider bg-surface px-3 py-2 text-sm text-content">
        {folder.name}
        {folder.permission === "prompt" ? " · needs access" : ""}
      </span>
      <button
        type="button"
        className={secondaryButtonClass}
        aria-label={protoCopy.moreActions}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        ···
      </button>
      {menuOpen ? (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[10rem] rounded-md border border-divider bg-surface py-1 shadow-md">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary-hover"
            onClick={() => {
              props.onChangeFolder();
              setMenuOpen(false);
            }}
          >
            {protoCopy.changeFolder}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-danger hover:bg-destructive-muted"
            onClick={() => {
              props.onClearFolder();
              setMenuOpen(false);
            }}
          >
            {protoCopy.clearFolder}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StickyOutcomeStrip(props: ArchivePrototypeModel) {
  const { outcome } = props;
  if (!outcome) return null;

  let message = "";
  let action: { label: string; onClick: () => void } | null = null;
  let danger = false;

  if (outcome.kind === "archived") {
    message = protoCopy.issueOkArchived;
  } else if (outcome.kind === "collision") {
    message = fill(protoCopy.issueOkCollision, { filename: outcome.filename });
    danger = true;
  } else if (outcome.kind === "needs-folder") {
    message = protoCopy.issueOkNeedsFolder;
    action = { label: protoCopy.chooseAndRetry, onClick: props.onChooseFolder };
    danger = true;
  } else {
    message = protoCopy.issueOkNeedsPermission;
    action = { label: protoCopy.grantAndRetry, onClick: props.onGrantPermission };
    danger = true;
  }

  return (
    <div
      className={`fixed bottom-20 left-1/2 z-[90] w-[min(40rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg px-4 py-3 shadow-lg ${
        danger ? errorBannerClass : "border border-accent-border bg-accent-muted text-sm text-accent"
      }`}
      role="status"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{message}</p>
        <div className="flex flex-wrap gap-2">
          {action ? (
            <button type="button" className={primaryButtonClass} onClick={action.onClick}>
              {action.label}
            </button>
          ) : null}
          <button type="button" className={secondaryButtonClass} onClick={props.onDismissOutcome}>
            {protoCopy.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
