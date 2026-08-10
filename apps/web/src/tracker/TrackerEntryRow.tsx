import type { DescriptionSuggestion, TimeEntry, UpdateTimeEntryInput } from "@hourden/domain";
import Calendar from "lucide-react/icons/calendar";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { DescriptionAutocomplete } from "../DescriptionAutocomplete.js";
import {
  destructiveOutlineButtonClass,
  inputClass,
  metaTextClass,
  mutedOutlineButtonClass,
  numericValueClass,
  selectClass,
} from "../layout/ui-classes.js";
import type { ProjectClientGroup } from "./groupProjectsByClient.js";
import {
  localDateAndTimeToIso,
  localDateValue,
  localTimeValue,
  shiftInstantByLocalDateDelta,
} from "./localDatetimeValue.js";

type EditableField = "description" | "project" | "start" | "end" | "date";

type TrackerEntryRowProps = {
  entry: TimeEntry;
  projectName: string | null;
  projectGroups: ProjectClientGroup[];
  isMobile: boolean;
  formatDurationMinutes: (minutes: number) => string;
  formatCurrency: (amount: number) => string;
  formatDateTime: (iso: string) => string;
  saving: boolean;
  onPatch: (patch: UpdateTimeEntryInput) => Promise<void>;
  onDelete: () => void;
  onMobileEdit: () => void;
};

const CALENDAR_ICON_SIZE = 14;
const CALENDAR_ICON_STROKE = 1.75;

export function TrackerEntryRow({
  entry,
  projectName,
  projectGroups,
  isMobile,
  formatDurationMinutes,
  formatCurrency,
  formatDateTime,
  saving,
  onPatch,
  onDelete,
  onMobileEdit,
}: TrackerEntryRowProps) {
  const { t } = useTranslation();
  const frozen = entry.locked || entry.isRunning;
  const editable = !frozen && !isMobile;
  const lockedReadOnlyHelp = entry.locked
    ? t("tracker.invoicedReadOnlyHelp")
    : undefined;

  const [activeField, setActiveField] = useState<EditableField | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState(entry.description ?? "");
  const [projectDraft, setProjectDraft] = useState(entry.projectId ?? "");
  const [startTimeDraft, setStartTimeDraft] = useState(
    localTimeValue(new Date(entry.startedAt)),
  );
  const [endTimeDraft, setEndTimeDraft] = useState(
    entry.endedAt ? localTimeValue(new Date(entry.endedAt)) : "",
  );
  const [dateDraft, setDateDraft] = useState(
    localDateValue(new Date(entry.startedAt)),
  );

  const saveDescription = async () => {
    setActiveField(null);
    const trimmed = descriptionDraft.trim();
    if (trimmed === (entry.description ?? "").trim()) {
      return;
    }
    try {
      await onPatch({ description: trimmed });
    } catch {
      setDescriptionDraft(entry.description ?? "");
    }
  };

  const applyDescriptionSuggestion = async (suggestion: DescriptionSuggestion) => {
    setDescriptionDraft(suggestion.description);
    setProjectDraft(suggestion.projectId ?? "");
    setActiveField(null);
    try {
      await onPatch({
        description: suggestion.description,
        projectId: suggestion.projectId,
      });
    } catch {
      setDescriptionDraft(entry.description ?? "");
      setProjectDraft(entry.projectId ?? "");
    }
  };

  const saveProject = async (nextProjectId: string) => {
    setActiveField(null);
    const normalized = nextProjectId || null;
    if (normalized === entry.projectId) {
      return;
    }
    try {
      await onPatch({ projectId: normalized });
    } catch {
      setProjectDraft(entry.projectId ?? "");
    }
  };

  const saveStart = async () => {
    setActiveField(null);
    const originalTime = localTimeValue(new Date(entry.startedAt));
    if (startTimeDraft === originalTime) {
      return;
    }
    const dateYmd = localDateValue(new Date(entry.startedAt));
    try {
      await onPatch({
        startedAt: localDateAndTimeToIso(dateYmd, startTimeDraft),
      });
    } catch {
      setStartTimeDraft(originalTime);
    }
  };

  const saveEnd = async () => {
    setActiveField(null);
    if (!endTimeDraft || !entry.endedAt) {
      return;
    }
    const originalTime = localTimeValue(new Date(entry.endedAt));
    if (endTimeDraft === originalTime) {
      return;
    }
    const dateYmd = localDateValue(new Date(entry.endedAt));
    try {
      await onPatch({
        endedAt: localDateAndTimeToIso(dateYmd, endTimeDraft),
      });
    } catch {
      setEndTimeDraft(originalTime);
    }
  };

  const saveDate = async () => {
    setActiveField(null);
    const originalDate = localDateValue(new Date(entry.startedAt));
    if (dateDraft === originalDate) {
      return;
    }
    const patch: UpdateTimeEntryInput = {
      startedAt: shiftInstantByLocalDateDelta(
        entry.startedAt,
        originalDate,
        dateDraft,
      ),
    };
    if (entry.endedAt) {
      patch.endedAt = shiftInstantByLocalDateDelta(
        entry.endedAt,
        originalDate,
        dateDraft,
      );
    }
    try {
      await onPatch(patch);
    } catch {
      setDateDraft(originalDate);
    }
  };

  const descriptionDisplay =
    entry.description?.trim() || (
      <span className="text-muted italic">{t("tracker.noDescription")}</span>
    );

  const rowSummaryLabel = [
    entry.description?.trim() || t("tracker.noDescription"),
    projectName ?? t("tracker.noProject"),
    formatDateTime(entry.startedAt),
    entry.endedAt ? formatDateTime(entry.endedAt) : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <li className="flex items-start justify-between gap-4 px-4 py-4">
      <div className="min-w-0 flex-1" title={lockedReadOnlyHelp}>
        {isMobile && !frozen ? (
          <button
            type="button"
            onClick={onMobileEdit}
            className="w-full text-left"
          >
            <p className="font-medium text-content">{descriptionDisplay}</p>
            <p className={`mt-1 ${metaTextClass}`}>
              {projectName ?? t("tracker.noProject")}
              {" · "}
              {formatDateTime(entry.startedAt)}
              {entry.endedAt && ` – ${formatDateTime(entry.endedAt)}`}
            </p>
          </button>
        ) : (
          <>
            {editable && activeField === "description" ? (
              <DescriptionAutocomplete
                label={t("tracker.description")}
                hideLabel
                value={descriptionDraft}
                onChange={setDescriptionDraft}
                onSuggestionSelect={(suggestion) => {
                  void applyDescriptionSuggestion(suggestion);
                }}
                onBlur={() => {
                  void saveDescription();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    setDescriptionDraft(entry.description ?? "");
                    setActiveField(null);
                  }
                }}
                autoFocus
                inputClassName={inputClass}
              />
            ) : (
              <p className="font-medium text-content">
                {editable ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionDraft(entry.description ?? "");
                      setActiveField("description");
                    }}
                    className="text-left hover:underline"
                  >
                    {descriptionDisplay}
                  </button>
                ) : (
                  descriptionDisplay
                )}
              </p>
            )}

            <div className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 ${metaTextClass}`}>
              {editable && activeField === "project" ? (
                <select
                  aria-label={t("tracker.projectOptional")}
                  value={projectDraft}
                  onChange={(event) => {
                    const value = event.target.value;
                    setProjectDraft(value);
                    void saveProject(value);
                  }}
                  onBlur={() => setActiveField(null)}
                  autoFocus
                  className={selectClass}
                >
                  <option value="">{t("tracker.noProject")}</option>
                  {projectGroups.map((group) => (
                    <optgroup key={group.clientId} label={group.clientName}>
                      {group.projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : editable ? (
                <button
                  type="button"
                  onClick={() => {
                    setProjectDraft(entry.projectId ?? "");
                    setActiveField("project");
                  }}
                  className="hover:underline"
                >
                  {projectName ?? t("tracker.noProject")}
                </button>
              ) : (
                <span>{projectName ?? t("tracker.noProject")}</span>
              )}

              <span aria-hidden="true">·</span>

              {editable && activeField === "start" ? (
                <input
                  aria-label={t("tracker.start")}
                  type="time"
                  value={startTimeDraft}
                  onChange={(event) => setStartTimeDraft(event.target.value)}
                  onBlur={() => void saveStart()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                      setStartTimeDraft(localTimeValue(new Date(entry.startedAt)));
                      setActiveField(null);
                    }
                  }}
                  autoFocus
                  className={inputClass}
                />
              ) : editable ? (
                <button
                  type="button"
                  aria-label={`${t("tracker.start")}: ${formatDateTime(entry.startedAt)}`}
                  onClick={() => {
                    setStartTimeDraft(localTimeValue(new Date(entry.startedAt)));
                    setActiveField("start");
                  }}
                  className="hover:underline"
                >
                  {formatDateTime(entry.startedAt)}
                </button>
              ) : (
                <span>{formatDateTime(entry.startedAt)}</span>
              )}

              {entry.endedAt && (
                <>
                  <span aria-hidden="true">–</span>
                  {editable && activeField === "end" ? (
                    <input
                      aria-label={t("tracker.end")}
                      type="time"
                      value={endTimeDraft}
                      onChange={(event) => setEndTimeDraft(event.target.value)}
                      onBlur={() => void saveEnd()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          setEndTimeDraft(localTimeValue(new Date(entry.endedAt!)));
                          setActiveField(null);
                        }
                      }}
                      autoFocus
                      className={inputClass}
                    />
                  ) : editable ? (
                    <button
                      type="button"
                      aria-label={`${t("tracker.end")}: ${formatDateTime(entry.endedAt)}`}
                      onClick={() => {
                        setEndTimeDraft(localTimeValue(new Date(entry.endedAt!)));
                        setActiveField("end");
                      }}
                      className="hover:underline"
                    >
                      {formatDateTime(entry.endedAt)}
                    </button>
                  ) : (
                    <span>{formatDateTime(entry.endedAt)}</span>
                  )}
                </>
              )}

              {editable && activeField === "date" ? (
                <input
                  aria-label={t("tracker.date")}
                  type="date"
                  value={dateDraft}
                  onChange={(event) => setDateDraft(event.target.value)}
                  onBlur={() => void saveDate()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                      setDateDraft(localDateValue(new Date(entry.startedAt)));
                      setActiveField(null);
                    }
                  }}
                  autoFocus
                  className={inputClass}
                />
              ) : editable ? (
                <button
                  type="button"
                  aria-label={t("tracker.changeDate")}
                  onClick={() => {
                    setDateDraft(localDateValue(new Date(entry.startedAt)));
                    setActiveField("date");
                  }}
                  className="inline-flex items-center text-muted hover:text-content"
                >
                  <Calendar
                    size={CALENDAR_ICON_SIZE}
                    strokeWidth={CALENDAR_ICON_STROKE}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
            </div>
          </>
        )}

        {(entry.amount !== null || (!entry.billableComplete && !entry.isRunning)) && (
          <p className={`mt-1 ${metaTextClass}`}>
            {entry.amount !== null && formatCurrency(entry.amount)}
            {!entry.billableComplete &&
              !entry.isRunning &&
              `${entry.amount !== null ? " · " : ""}${t("tracker.incomplete")}`}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-start gap-3">
        <p
          aria-label={`${t("tracker.duration")}: ${formatDurationMinutes(entry.durationMinutes)}`}
          className={`${numericValueClass} text-sm`}
        >
          {formatDurationMinutes(entry.durationMinutes)}
          {entry.isRunning && (
            <span className={`block ${metaTextClass}`}>{t("tracker.running")}</span>
          )}
        </p>
        {entry.locked ? (
          <button
            type="button"
            disabled
            aria-label={t("tracker.invoiced")}
            title={lockedReadOnlyHelp}
            className={`${mutedOutlineButtonClass} px-3 py-1.5 text-sm`}
          >
            {t("tracker.invoiced")}
          </button>
        ) : !entry.isRunning ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className={`${destructiveOutlineButtonClass} px-3 py-1.5 text-sm`}
          >
            {t("common.delete")}
          </button>
        ) : null}
      </div>

      <span className="sr-only">{rowSummaryLabel}</span>
    </li>
  );
}
