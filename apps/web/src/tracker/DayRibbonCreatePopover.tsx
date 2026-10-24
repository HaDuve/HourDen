import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { DescriptionAutocomplete } from "../DescriptionAutocomplete.js";
import {
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  selectClass,
} from "../layout/ui-classes.js";
import type { ProjectClientGroup } from "./groupProjectsByClient.js";

export type DayRibbonCreateDraft = {
  startedAt: string;
  endedAt: string;
  startLabel: string;
  endLabel: string;
};

type DayRibbonCreatePopoverProps = {
  draft: DayRibbonCreateDraft;
  projectGroups: ProjectClientGroup[];
  description: string;
  projectId: string;
  saving: boolean;
  error: string | null;
  onDescriptionChange: (value: string) => void;
  onProjectIdChange: (value: string) => void;
  onSuggestionSelect: (suggestion: {
    description: string;
    projectId: string | null;
  }) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function DayRibbonCreatePopover({
  draft,
  projectGroups,
  description,
  projectId,
  saving,
  error,
  onDescriptionChange,
  onProjectIdChange,
  onSuggestionSelect,
  onSubmit,
  onCancel,
}: DayRibbonCreatePopoverProps) {
  const { t } = useTranslation();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div
      role="dialog"
      aria-label={t("tracker.manualEntry")}
      className={`absolute left-0 right-0 top-full z-20 mt-2 p-3 shadow-lg ${cardClass}`}
    >
      <form onSubmit={handleSubmit} className="grid gap-3">
        <div className="flex flex-wrap gap-3 text-sm text-content">
          <label className="grid gap-1">
            <span>{t("tracker.start")}</span>
            <input
              readOnly
              value={draft.startLabel}
              className={`${inputClass} w-24`}
            />
          </label>
          <label className="grid gap-1">
            <span>{t("tracker.end")}</span>
            <input
              readOnly
              value={draft.endLabel}
              className={`${inputClass} w-24`}
            />
          </label>
        </div>

        <DescriptionAutocomplete
          label={t("tracker.description")}
          value={description}
          required
          autoFocus
          onChange={onDescriptionChange}
          onSuggestionSelect={onSuggestionSelect}
        />

        <label className="grid gap-1 text-sm text-content">
          <span>{t("tracker.projectOptional")}</span>
          <select
            value={projectId}
            onChange={(event) => onProjectIdChange(event.target.value)}
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
        </label>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving || !description.trim()}
            className={primaryButtonClass}
          >
            {t("tracker.addEntry")}
          </button>
          <button
            type="button"
            disabled={saving}
            className={secondaryButtonClass}
            onClick={onCancel}
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
