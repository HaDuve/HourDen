import type { TimeEntry } from "@hourden/domain";
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
import type { ProjectClientGroup } from "./groupProjectsByClient.js";

type TrackerTimerBarProps = {
  running: TimeEntry | null;
  liveCounter: string;
  description: string;
  projectId: string;
  projectGroups: ProjectClientGroup[];
  saving: boolean;
  onDescriptionChange: (description: string) => void;
  onDescriptionSuggestionSelect: (suggestion: {
    description: string;
    projectId: string | null;
  }) => void;
  onProjectChange: (projectId: string) => void;
  onStart: () => void;
  onStop: () => void;
};

export function TrackerTimerBar({
  running,
  liveCounter,
  description,
  projectId,
  projectGroups,
  saving,
  onDescriptionChange,
  onDescriptionSuggestionSelect,
  onProjectChange,
  onStart,
  onStop,
}: TrackerTimerBarProps) {
  const { t } = useTranslation();
  const isRunning = running !== null;

  return (
    <section
      aria-label={t("tracker.timerBar")}
      className={`sticky top-0 z-10 ${panelClass} shadow-sm`}
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
    </section>
  );
}
