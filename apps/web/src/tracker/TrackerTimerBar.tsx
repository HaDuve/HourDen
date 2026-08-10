import type { TimeEntry } from "@hourden/domain";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DescriptionAutocomplete } from "../DescriptionAutocomplete.js";
import {
  destructiveButtonClass,
  inputClass,
  numericValueClass,
  panelClass,
  primaryButtonClass,
  selectClass,
} from "../layout/ui-classes.js";
import {
  EntryScheduleFields,
  type EntryScheduleValue,
} from "./EntryScheduleFields.js";
import type { ProjectClientGroup } from "./groupProjectsByClient.js";
import {
  applyScheduleFieldsChange,
  localDateValue,
} from "./localDatetimeValue.js";

type TrackerTimerBarProps = {
  running: TimeEntry | null;
  liveCounter: string;
  description: string;
  projectId: string;
  projectGroups: ProjectClientGroup[];
  saving: boolean;
  startedAt: string;
  endedAt: string;
  onDescriptionChange: (description: string) => void;
  onDescriptionSuggestionSelect: (suggestion: {
    description: string;
    projectId: string | null;
  }) => void;
  onProjectChange: (projectId: string) => void;
  onStartedAtChange: (startedAt: string) => void;
  onEndedAtChange: (endedAt: string) => void;
  onStart: () => void;
  onStop: () => void;
  onAddManual: () => void;
};

function scheduleFromBar(
  startedAt: string,
  endedAt: string,
  fallbackDate: string,
): EntryScheduleValue {
  return {
    date: startedAt.slice(0, 10) || endedAt.slice(0, 10) || fallbackDate,
    startTime: startedAt.length >= 16 ? startedAt.slice(11, 16) : "",
    endTime: endedAt.length >= 16 ? endedAt.slice(11, 16) : "",
  };
}

function datetimesFromSchedule(
  previous: { startedAt: string; endedAt: string },
  schedule: EntryScheduleValue,
): { startedAt: string; endedAt: string } {
  const baseStarted = previous.startedAt || `${schedule.date}T00:00`;
  const baseEnded =
    previous.endedAt || previous.startedAt || `${schedule.date}T00:00`;
  const applied = applyScheduleFieldsChange(
    { startedAt: baseStarted, endedAt: baseEnded },
    schedule,
  );
  return {
    startedAt: schedule.startTime ? applied.startedAt : "",
    endedAt: schedule.endTime ? applied.endedAt : "",
  };
}

export function TrackerTimerBar({
  running,
  liveCounter,
  description,
  projectId,
  projectGroups,
  saving,
  startedAt,
  endedAt,
  onDescriptionChange,
  onDescriptionSuggestionSelect,
  onProjectChange,
  onStartedAtChange,
  onEndedAtChange,
  onStart,
  onStop,
  onAddManual,
}: TrackerTimerBarProps) {
  const { t } = useTranslation();
  const isRunning = running !== null;
  const isManualReady = !isRunning && startedAt !== "" && endedAt !== "";
  const today = localDateValue(new Date());
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const schedule = scheduleFromBar(
    startedAt,
    endedAt,
    pickedDate ?? today,
  );

  const handleScheduleChange = (next: EntryScheduleValue) => {
    setPickedDate(next.date);
    const nextDatetimes = datetimesFromSchedule(
      { startedAt, endedAt },
      next,
    );
    if (nextDatetimes.startedAt !== startedAt) {
      onStartedAtChange(nextDatetimes.startedAt);
    }
    if (nextDatetimes.endedAt !== endedAt) {
      onEndedAtChange(nextDatetimes.endedAt);
    }
  };

  return (
    <section
      aria-label={t("tracker.timerBar")}
      className={`sticky top-0 z-10 md:top-14 ${panelClass} shadow-sm`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <DescriptionAutocomplete
            label={t("tracker.description")}
            hideLabel
            value={description}
            onChange={onDescriptionChange}
            onSuggestionSelect={onDescriptionSuggestionSelect}
            inputClassName={inputClass}
          />
        </div>

        <label className="shrink-0 sm:w-44">
          <span className="sr-only">{t("tracker.projectOptional")}</span>
          <select
            aria-label={t("tracker.projectOptional")}
            value={projectId}
            onChange={(event) => onProjectChange(event.target.value)}
            className={`w-full ${selectClass}`}
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
        </label>

        <div className="flex shrink-0 items-center gap-3">
          <p
            aria-live="polite"
            className={`min-w-[5.5rem] ${numericValueClass} text-lg`}
          >
            {liveCounter}
          </p>

          {isRunning ? (
            <button
              type="button"
              onClick={onStop}
              disabled={saving}
              className={destructiveButtonClass}
            >
              {t("tracker.stopTimer")}
            </button>
          ) : isManualReady ? (
            <button
              type="button"
              onClick={onAddManual}
              disabled={saving}
              className={primaryButtonClass}
            >
              {t("tracker.addEntry")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              disabled={saving}
              className={primaryButtonClass}
            >
              {t("tracker.startTimer")}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <EntryScheduleFields
          value={schedule}
          disabled={saving}
          onChange={handleScheduleChange}
        />
      </div>
    </section>
  );
}
