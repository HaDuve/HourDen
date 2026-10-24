import type { QuickLogProjectCandidate, QuickLogResult } from "@hourden/domain";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  bodyTextClass,
  cardClass,
  inputClass,
  metaTextClass,
  pageSubtitleClass,
} from "../layout/ui-classes.js";
import { useModalFocus } from "../layout/use-modal-focus.js";
import { useLocaleFormat } from "../locale/use-locale-format.js";
import { formatPreviewTime } from "./format-preview-time.js";

type QuickLogDialogProps = {
  query: string;
  onQueryChange: (value: string) => void;
  result: QuickLogResult;
  timeZone: string;
  selectedProjectId: string | null;
  onSelectedProjectIdChange: (id: string | null) => void;
  onClose: () => void;
  /** Optional project id when committing from the ambiguous pick list. */
  onCommit: (projectId?: string) => void;
  committing: boolean;
  error: string | null;
};

function optionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

function PreviewLine({ result, timeZone }: { result: QuickLogResult; timeZone: string }) {
  const { t } = useTranslation();
  const { formatCurrency, formatDurationMinutes, formatIsoDate } = useLocaleFormat();

  if (result.kind === "empty") {
    return <p className={metaTextClass}>{t("quickLog.hint")}</p>;
  }

  if (result.kind === "incomplete") {
    return (
      <p className={metaTextClass} role="status">
        {t("quickLog.missing", {
          fields: result.missing.map((key) => t(`quickLog.missingFields.${key}`)).join(", "),
        })}
      </p>
    );
  }

  if (result.kind === "stop") {
    return <p className={bodyTextClass}>{t("quickLog.previewStop")}</p>;
  }

  if (result.kind === "navigate") {
    return (
      <p className={bodyTextClass}>
        {t("quickLog.previewNavigate", {
          destination: t(`nav.${result.destination}`),
        })}
      </p>
    );
  }

  if (result.kind === "start") {
    const projectLabel = result.projectName
      ? result.clientName
        ? `${result.projectName} → ${result.clientName}`
        : result.projectName
      : t("quickLog.noProject");
    return (
      <p className={bodyTextClass}>
        {t("quickLog.previewStart", {
          project: projectLabel,
          description: result.description ?? t("quickLog.noDescription"),
        })}
      </p>
    );
  }

  const projectLabel = result.projectName
    ? result.clientName
      ? `${result.projectName} → ${result.clientName}`
      : result.projectName
    : t("quickLog.noProject");
  const amount =
    result.amountPreview !== null ? formatCurrency(result.amountPreview) : t("quickLog.noAmount");

  return (
    <p className={bodyTextClass}>
      {t("quickLog.previewManual", {
        date: formatIsoDate(result.dateKey),
        start: formatPreviewTime(result.startedAt, timeZone),
        end: formatPreviewTime(result.endedAt, timeZone),
        duration: formatDurationMinutes(result.durationMinutes),
        project: projectLabel,
        description: result.description ?? t("quickLog.noDescription"),
        amount,
      })}
    </p>
  );
}

export function QuickLogDialog({
  query,
  onQueryChange,
  result,
  timeZone,
  selectedProjectId,
  onSelectedProjectIdChange,
  onClose,
  onCommit,
  committing,
  error,
}: QuickLogDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  useModalFocus({ containerRef: dialogRef, onClose });

  const candidates: QuickLogProjectCandidate[] =
    (result.kind === "manual" || result.kind === "start") && result.candidates
      ? result.candidates
      : [];
  const showCandidates = candidates.length > 0;

  useEffect(() => {
    setActiveIndex(null);
  }, [query, showCandidates]);

  useEffect(() => {
    if (!showCandidates || selectedProjectId === null) {
      return;
    }
    const index = candidates.findIndex((c) => c.id === selectedProjectId);
    if (index >= 0) {
      setActiveIndex(index);
    }
  }, [candidates, selectedProjectId, showCandidates]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (showCandidates && activeIndex !== null) {
      const picked = candidates[activeIndex];
      if (picked) {
        onSelectedProjectIdChange(picked.id);
        onCommit(picked.id);
      }
      return;
    }
    onCommit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showCandidates) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => {
        if (current === null) return 0;
        return Math.min(current + 1, candidates.length - 1);
      });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => {
        if (current === null) return candidates.length - 1;
        return Math.max(current - 1, 0);
      });
    }
  };

  const activeDescendant =
    showCandidates && activeIndex !== null
      ? optionId(listboxId, activeIndex)
      : undefined;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("quickLog.title")}
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 p-4 pt-[15vh]"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-xl overflow-hidden shadow-lg ${cardClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-3">
          <label className="sr-only" htmlFor="quick-log-input">
            {t("quickLog.inputLabel")}
          </label>
          <input
            id="quick-log-input"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showCandidates}
            aria-controls={showCandidates ? listboxId : undefined}
            aria-activedescendant={activeDescendant}
            value={query}
            onChange={(event) => {
              onSelectedProjectIdChange(null);
              onQueryChange(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("quickLog.placeholder")}
            autoComplete="off"
            spellCheck={false}
            disabled={committing}
            className={`w-full ${inputClass}`}
          />
        </form>

        <div className="border-t border-divider px-3 py-2">
          <PreviewLine result={result} timeZone={timeZone} />
          {error ? (
            <p className={`${metaTextClass} mt-1 text-danger`} role="alert">
              {error}
            </p>
          ) : null}
          {result.commitable ? (
            <p className={`${pageSubtitleClass} mt-1`}>{t("quickLog.enterHint")}</p>
          ) : null}
        </div>

        {showCandidates ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={t("quickLog.projectChoices")}
            className="max-h-48 overflow-y-auto border-t border-divider"
          >
            {candidates.map((candidate, index) => {
              const selected = index === activeIndex;
              return (
                <li
                  key={candidate.id}
                  id={optionId(listboxId, index)}
                  role="option"
                  aria-selected={selected}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    selected ? "bg-accent-muted text-content" : "text-content hover:bg-surface"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    onSelectedProjectIdChange(candidate.id);
                    onCommit(candidate.id);
                  }}
                >
                  {candidate.name}
                  {candidate.clientName ? (
                    <span className={`ml-2 ${metaTextClass}`}>{candidate.clientName}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
