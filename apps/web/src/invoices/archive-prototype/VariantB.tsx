import { ResponsiveOverlay } from "../../layout/ResponsiveOverlay.js";
import {
  errorBannerClass,
  fieldLabelClass,
  metaTextClass,
  panelClass,
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

export const variantBName = "Setup panel + modal";

/** Dedicated archive panel with persist tip; missing-root uses ResponsiveOverlay. */
export function VariantB(props: ArchivePrototypeModel) {
  const showModal =
    props.outcome?.kind === "needs-folder" ||
    props.outcome?.kind === "needs-permission";

  return (
    <div className="space-y-4">
      <SimulateRow {...props} />
      <ArchiveSetupPanel {...props} />
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
      <InlineNonModalOutcomes {...props} />
      {showModal ? <MissingAccessOverlay {...props} /> : null}
      <StateDump {...props} />
    </div>
  );
}

function ArchiveSetupPanel(props: ArchivePrototypeModel) {
  const { folder } = props;

  if (folder.status === "unsupported") {
    return (
      <div className={panelClass}>
        <h2 className={`mb-1 ${fieldLabelClass}`}>{protoCopy.archiveFolder}</h2>
        <p className={metaTextClass}>{protoCopy.unsupported}</p>
      </div>
    );
  }

  if (folder.status === "unset") {
    return (
      <div className={`${panelClass} space-y-3`}>
        <h2 className={fieldLabelClass}>{protoCopy.archiveFolder}</h2>
        <p className={metaTextClass}>{protoCopy.folderUnset}</p>
        <button type="button" className={primaryButtonClass} onClick={props.onChooseFolder}>
          {protoCopy.chooseFolder}
        </button>
        <p className={`text-xs ${metaTextClass}`}>{protoCopy.persistTip}</p>
      </div>
    );
  }

  return (
    <div className={`${panelClass} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={fieldLabelClass}>{protoCopy.archiveFolder}</h2>
          <p className={`mt-1 ${metaTextClass}`}>
            {fill(protoCopy.folderSet, { name: folder.name })}
            {folder.permission === "prompt" ? (
              <span className="mt-1 block text-accent">Permission needed on next write.</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButtonClass} onClick={props.onChangeFolder}>
            {protoCopy.changeFolder}
          </button>
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm text-danger underline"
            onClick={props.onClearFolder}
          >
            {protoCopy.clearFolder}
          </button>
        </div>
      </div>
      <p className={`text-xs ${metaTextClass}`}>{protoCopy.persistTip}</p>
    </div>
  );
}

function InlineNonModalOutcomes(props: ArchivePrototypeModel) {
  const { outcome } = props;
  if (!outcome) return null;
  if (outcome.kind === "needs-folder" || outcome.kind === "needs-permission") {
    return null;
  }
  if (outcome.kind === "archived") {
    return (
      <p className="rounded-md border border-accent-border bg-accent-muted px-4 py-3 text-sm text-accent">
        {protoCopy.issueOkArchived}{" "}
        <button type="button" className="underline" onClick={props.onDismissOutcome}>
          {protoCopy.dismiss}
        </button>
      </p>
    );
  }
  return (
    <p className={errorBannerClass} role="alert">
      {fill(protoCopy.issueOkCollision, { filename: outcome.filename })}{" "}
      <button type="button" className="underline" onClick={props.onDismissOutcome}>
        {protoCopy.dismiss}
      </button>
    </p>
  );
}

function MissingAccessOverlay(props: ArchivePrototypeModel) {
  const needsFolder = props.outcome?.kind === "needs-folder";
  return (
    <ResponsiveOverlay
      ariaLabel={needsFolder ? protoCopy.issueOkNeedsFolder : protoCopy.issueOkNeedsPermission}
      onBackdropClick={props.onDismissOutcome}
    >
      <h2 className="text-lg font-semibold text-content">
        {needsFolder ? "Choose archive folder" : "Allow folder access"}
      </h2>
      <p className={`mt-2 ${metaTextClass}`}>
        {needsFolder ? protoCopy.issueOkNeedsFolder : protoCopy.issueOkNeedsPermission}
      </p>
      {!needsFolder ? (
        <p className={`mt-2 text-xs ${metaTextClass}`}>{protoCopy.persistTip}</p>
      ) : (
        <p className={`mt-2 text-xs ${metaTextClass}`}>{protoCopy.persistTip}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            if (needsFolder) props.onChooseFolder();
            else props.onGrantPermission();
            props.onRetryFile();
          }}
        >
          {needsFolder ? protoCopy.chooseAndRetry : protoCopy.grantAndRetry}
        </button>
        <button type="button" className={secondaryButtonClass} onClick={props.onDismissOutcome}>
          {protoCopy.dismiss}
        </button>
      </div>
    </ResponsiveOverlay>
  );
}
