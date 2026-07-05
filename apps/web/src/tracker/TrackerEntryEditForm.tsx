import type { TimeEntry, UpdateTimeEntryInput } from "@hourden/domain";
import { useTranslation } from "react-i18next";
import { DescriptionAutocomplete } from "../DescriptionAutocomplete.js";
import {
  inputClass,
  numericValueClass,
  primaryButtonClass,
  secondaryButtonClass,
  selectClass,
} from "../layout/ui-classes.js";
import type { ProjectClientGroup } from "./groupProjectsByClient.js";
import { localDatetimeValue } from "./localDatetimeValue.js";

export type TrackerEntryEditFormData = {
  description: string;
  projectId: string;
  startedAt: string;
  endedAt: string;
};

type TrackerEntryEditFormProps = {
  form: TrackerEntryEditFormData;
  durationMinutes: number;
  projectGroups: ProjectClientGroup[];
  saving: boolean;
  formatDurationMinutes: (minutes: number) => string;
  onChange: (form: TrackerEntryEditFormData) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
};

export function TrackerEntryEditForm({
  form,
  durationMinutes,
  projectGroups,
  saving,
  formatDurationMinutes,
  onChange,
  onSubmit,
  onCancel,
}: TrackerEntryEditFormProps) {
  const { t } = useTranslation();

  return (
    <form onSubmit={onSubmit} className="w-full">
      <h2 className="text-lg font-semibold text-content">{t("tracker.editEntry")}</h2>

      <div className="mt-4 grid gap-3">
        <DescriptionAutocomplete
          label={t("tracker.description")}
          value={form.description}
          required
          onChange={(description) => onChange({ ...form, description })}
          onSuggestionSelect={(suggestion) =>
            onChange({
              ...form,
              description: suggestion.description,
              projectId: suggestion.projectId ?? "",
            })
          }
        />

        <label className="grid gap-1 text-sm text-content">
          <span>{t("tracker.projectOptional")}</span>
          <select
            value={form.projectId}
            onChange={(event) => onChange({ ...form, projectId: event.target.value })}
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

        <label className="grid gap-1 text-sm text-content">
          <span>{t("tracker.start")}</span>
          <input
            required
            type="datetime-local"
            value={form.startedAt}
            onChange={(event) => onChange({ ...form, startedAt: event.target.value })}
            className={inputClass}
          />
        </label>

        <label className="grid gap-1 text-sm text-content">
          <span>{t("tracker.end")}</span>
          <input
            required
            type="datetime-local"
            value={form.endedAt}
            onChange={(event) => onChange({ ...form, endedAt: event.target.value })}
            className={inputClass}
          />
        </label>

        <p className="text-sm text-content">
          <span>{t("tracker.duration")}: </span>
          <span className={numericValueClass}>
            {formatDurationMinutes(durationMinutes)}
          </span>
        </p>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          {t("common.cancel")}
        </button>
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </form>
  );
}

export function entryToEditForm(entry: TimeEntry): TrackerEntryEditFormData {
  return {
    description: entry.description ?? "",
    projectId: entry.projectId ?? "",
    startedAt: localDatetimeValue(new Date(entry.startedAt)),
    endedAt: entry.endedAt
      ? localDatetimeValue(new Date(entry.endedAt))
      : localDatetimeValue(new Date()),
  };
}

export function toEditPatch(
  form: TrackerEntryEditFormData,
  original: TimeEntry,
): UpdateTimeEntryInput {
  const originalForm = entryToEditForm(original);
  const patch: UpdateTimeEntryInput = {
    description: form.description.trim(),
    projectId: form.projectId || null,
  };

  if (form.startedAt !== originalForm.startedAt) {
    patch.startedAt = new Date(form.startedAt).toISOString();
  }

  if (form.endedAt !== originalForm.endedAt) {
    patch.endedAt = new Date(form.endedAt).toISOString();
  }

  return patch;
}
