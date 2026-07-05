import { groupTrackerEntriesByWeek, type TimeEntry } from "@hourden/domain";
import type { Project } from "@hourden/domain";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useState } from "react";
import { PageMain } from "./layout/PageMain.js";
import { ResponsiveOverlay } from "./layout/ResponsiveOverlay.js";
import {
  mobileActionButtonClass,
  mobilePrimaryButtonClass,
  mobileSecondaryButtonClass,
} from "./layout/tap-targets.js";
import {
  accentInputClass,
  destructiveButtonClass,
  destructiveOutlineButtonClass,
  emptyStateClass,
  errorBannerClass,
  inputClass,
  listPanelClass,
  metaTextClass,
  pageSubtitleClass,
  pageTitleLargeClass,
  selectClass,
} from "./layout/ui-classes.js";
import { useIsMobile } from "./layout/use-is-mobile.js";
import { useLocaleFormat } from "./locale/use-locale-format.js";
import {
  readStoredTrackerEntryLimit,
  TRACKER_ENTRY_LIMITS,
  storeTrackerEntryLimit,
  type TrackerEntryLimit,
} from "./tracker-entry-limit.js";
import { todayDateInTimeZone } from "./today-date.js";
import { useDeleteDialog } from "./useDeleteDialog.js";
import { DescriptionAutocomplete } from "./DescriptionAutocomplete.js";

type ManualFormData = {
  description: string;
  startedAt: string;
  endedAt: string;
  projectId: string;
};

type EditFormData = {
  description: string;
  projectId: string;
};

type RunningFormData = {
  description: string;
  projectId: string;
};

function localDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyManualForm(): ManualFormData {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  return {
    description: "",
    startedAt: localDatetimeValue(oneHourAgo),
    endedAt: localDatetimeValue(now),
    projectId: "",
  };
}

async function fetchTrackerEntries(limit: TrackerEntryLimit): Promise<TimeEntry[]> {
  const res = await fetch(`/api/time-entries?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to load entries (${res.status})`);
  }
  const data = (await res.json()) as { entries: TimeEntry[] };
  return data.entries;
}

async function fetchRunningTimer(): Promise<TimeEntry | null> {
  const res = await fetch("/api/time-entries/running");
  if (!res.ok) {
    throw new Error(`Failed to load running timer (${res.status})`);
  }
  const data = (await res.json()) as { entry: TimeEntry | null };
  return data.entry;
}

async function fetchCalendarTimezone(): Promise<string> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load session (${res.status})`);
  }
  const data = (await res.json()) as { calendarTimezone: string };
  return data.calendarTimezone;
}

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) {
    throw new Error(`Failed to load projects (${res.status})`);
  }
  const data = (await res.json()) as { projects: Project[] };
  return data.projects;
}

export default function TrackerPage() {
  const { t } = useTranslation();
  const { locale, formatCurrency, formatDurationMinutes } = useLocaleFormat();
  const [calendarTimezone, setCalendarTimezone] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entryLimit, setEntryLimit] = useState<TrackerEntryLimit>(
    readStoredTrackerEntryLimit(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState<ManualFormData>(emptyManualForm);
  const [saving, setSaving] = useState(false);
  const {
    pendingDelete,
    isDeleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    getDeleteTargetId,
  } = useDeleteDialog<TimeEntry>();
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    description: "",
    projectId: "",
  });
  const [runningForm, setRunningForm] = useState<RunningFormData>({
    description: "",
    projectId: "",
  });

  const today =
    calendarTimezone === null ? null : todayDateInTimeZone(calendarTimezone);

  useEffect(() => {
    let cancelled = false;
    void fetchCalendarTimezone()
      .then((timeZone) => {
        if (!cancelled) {
          setCalendarTimezone(timeZone);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(t("tracker.loadFailed"));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!calendarTimezone) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [loadedEntries, loadedRunning, loadedProjects] = await Promise.all([
        fetchTrackerEntries(entryLimit),
        fetchRunningTimer(),
        fetchProjects(),
      ]);
      setEntries(loadedEntries);
      setRunning(loadedRunning);
      setProjects(loadedProjects);
    } catch (err) {
      setError(t("tracker.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [calendarTimezone, entryLimit]);

  useEffect(() => {
    if (calendarTimezone) {
      void load();
    }
  }, [calendarTimezone, load]);

  useEffect(() => {
    if (!running) {
      setRunningForm({ description: "", projectId: "" });
      return;
    }

    setRunningForm({
      description: running.description ?? "",
      projectId: running.projectId ?? "",
    });
  }, [running?.id]);

  const patchRunningEntry = async (patch: {
    description?: string;
    projectId?: string | null;
  }) => {
    if (!running) return;

    setError(null);
    try {
      const body: { description?: string | null; projectId?: string | null } = {
        ...patch,
      };
      if (patch.projectId !== undefined && patch.description === undefined) {
        body.description = runningForm.description.trim() || null;
      }

      const res = await fetch(`/api/time-entries/${running.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Update failed (${res.status})`);
      }
      const updated = (await res.json()) as TimeEntry;
      setRunning(updated);
      setRunningForm((current) => ({
        description:
          patch.description !== undefined ? patch.description : current.description,
        projectId: updated.projectId ?? "",
      }));
    } catch (err) {
      setError(t("tracker.saveFailed"));
    }
  };

  const handleLimitChange = (nextLimit: TrackerEntryLimit) => {
    setEntryLimit(nextLimit);
    storeTrackerEntryLimit(nextLimit);
  };

  const startTimer = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/time-entries/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`Start failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(t("tracker.startFailed"));
    } finally {
      setSaving(false);
    }
  };

  const stopTimer = async () => {
    if (!running) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/time-entries/${running.id}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: runningForm.description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(`Stop failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(t("tracker.stopFailed"));
    } finally {
      setSaving(false);
    }
  };

  const saveManualEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: manualForm.description.trim(),
          startedAt: new Date(manualForm.startedAt).toISOString(),
          endedAt: new Date(manualForm.endedAt).toISOString(),
          projectId: manualForm.projectId || null,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }

      setShowManualForm(false);
      setManualForm(emptyManualForm());
      await load();
    } catch (err) {
      setError(t("tracker.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (entry: TimeEntry) => {
    setEditing(entry);
    setEditForm({
      description: entry.description ?? "",
      projectId: entry.projectId ?? "",
    });
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/time-entries/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editForm.description.trim(),
          projectId: editForm.projectId || null,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }

      setEditing(null);
      await load();
    } catch (err) {
      setError(t("tracker.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const id = getDeleteTargetId();
    if (!id) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/time-entries/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Delete failed (${res.status})`);
      }
      closeDeleteDialog();
      await load();
    } catch (err) {
      setError(t("tracker.deleteFailed"));
    } finally {
      setSaving(false);
    }
  };

  const isMobile = useIsMobile();
  const actionButtonClass = mobileActionButtonClass(isMobile);
  const primaryButtonClass = mobilePrimaryButtonClass(isMobile);
  const secondaryButtonClass = mobileSecondaryButtonClass(isMobile);
  const weekGroups =
    calendarTimezone && today
      ? groupTrackerEntriesByWeek(entries, {
          timeZone: calendarTimezone,
          today,
          locale,
        })
      : [];

  return (
    <PageMain variant="flex">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={pageTitleLargeClass}>{t("tracker.title")}</h1>
          <p className={pageSubtitleClass}>{t("tracker.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowManualForm(true)}
            className={secondaryButtonClass}
          >
            {t("tracker.addManualEntry")}
          </button>
          {running ? (
            <button
              type="button"
              onClick={() => void stopTimer()}
              disabled={saving}
              className={destructiveButtonClass}
            >
              {t("tracker.stopTimer")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startTimer()}
              disabled={saving}
              className={primaryButtonClass}
            >
              {t("tracker.startTimer")}
            </button>
          )}
        </div>
      </header>

      {running && (
        <div className="rounded-lg border border-accent-border bg-accent-muted px-4 py-3 text-sm text-content">
          <p className="mb-3">
            {t("tracker.timerRunning", {
              duration: formatDurationMinutes(running.durationMinutes),
            })}
          </p>
          <div className="grid gap-3 text-content">
            <DescriptionAutocomplete
              label={t("tracker.description")}
              value={runningForm.description}
              onChange={(description) =>
                setRunningForm((current) => ({ ...current, description }))
              }
              onSuggestionSelect={(suggestion) => {
                setRunningForm({
                  description: suggestion.description,
                  projectId: suggestion.projectId ?? "",
                });
                void patchRunningEntry({
                  description: suggestion.description,
                  projectId: suggestion.projectId,
                });
              }}
              inputClassName={accentInputClass}
            />
            <label className="grid gap-1 text-sm text-content">
              <span>{t("tracker.projectOptional")}</span>
              <select
                value={runningForm.projectId}
                onChange={(event) => {
                  const projectId = event.target.value;
                  setRunningForm((current) => ({ ...current, projectId }));
                  void patchRunningEntry({ projectId: projectId || null });
                }}
                className={accentInputClass}
              >
                <option value="">{t("tracker.noProject")}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {error && (
        <p className={errorBannerClass}>
          {error}
        </p>
      )}

      {loading ? (
        <p className={metaTextClass}>{t("tracker.loading")}</p>
      ) : entries.length === 0 ? (
        <p className={emptyStateClass}>
          {t("tracker.empty")}
        </p>
      ) : (
        <div
          className={`space-y-6${isDeleteDialogOpen ? " pointer-events-none" : ""}`}
        >
          {weekGroups.map((week) => (
            <section key={week.weekStart}>
              <div className="mb-2 flex items-baseline justify-between gap-4 px-1">
                <h2 className="text-sm font-semibold text-content">{week.weekLabel}</h2>
                <p className={metaTextClass}>
                  {t("tracker.weekTotal")}: {formatDurationMinutes(week.totalDurationMinutes)}
                </p>
              </div>

              <div className="space-y-4">
                {week.days.map((day) => (
                  <div key={day.date}>
                    <div className="mb-1 flex items-baseline justify-between gap-4 border-b border-divider px-4 py-2">
                      <h3 className="text-sm font-medium text-content">{day.dayLabel}</h3>
                      <p className={metaTextClass}>
                        {t("tracker.dayTotal")}: {formatDurationMinutes(day.totalDurationMinutes)}
                      </p>
                    </div>

                    <ul className={listPanelClass}>
                      {day.entries.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-start justify-between gap-4 px-4 py-4"
                        >
                          <div>
                            <p className="font-medium">
                              {entry.description?.trim() || (
                                <span className="text-muted italic">
                                  {t("tracker.noDescription")}
                                </span>
                              )}
                            </p>
                            <p className={`mt-1 ${metaTextClass}`}>
                              {formatDurationMinutes(entry.durationMinutes)}
                              {entry.isRunning && ` · ${t("tracker.running")}`}
                              {entry.amount !== null && ` · ${formatCurrency(entry.amount)}`}
                              {!entry.billableComplete &&
                                !entry.isRunning &&
                                ` · ${t("tracker.incomplete")}`}
                            </p>
                          </div>
                          {!entry.invoiced && !entry.isRunning && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(entry)}
                                className={actionButtonClass}
                              >
                                {t("common.edit")}
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteDialog(entry)}
                                className={`${destructiveOutlineButtonClass} px-3 py-1.5 text-sm`}
                              >
                                {t("common.delete")}
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <label className={`flex items-center gap-2 ${metaTextClass}`}>
          <span>{t("tracker.showEntries")}</span>
          <select
            aria-label={t("tracker.showEntries")}
            value={entryLimit}
            onChange={(event) =>
              handleLimitChange(Number(event.target.value) as TrackerEntryLimit)
            }
            className={`${selectClass} px-2 py-1.5`}
          >
            {TRACKER_ENTRY_LIMITS.map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showManualForm && (
        <ResponsiveOverlay ariaLabel={t("tracker.manualEntry")}>
          <form onSubmit={saveManualEntry} className="w-full">
            <h2 className="text-lg font-semibold">{t("tracker.manualEntry")}</h2>

            <div className="mt-4 grid gap-3">
              <DescriptionAutocomplete
                label={t("tracker.description")}
                value={manualForm.description}
                required
                onChange={(description) =>
                  setManualForm((current) => ({
                    ...current,
                    description,
                  }))
                }
                onSuggestionSelect={(suggestion) =>
                  setManualForm((current) => ({
                    ...current,
                    description: suggestion.description,
                    projectId: suggestion.projectId ?? "",
                  }))
                }
              />

              <label className="grid gap-1 text-sm text-content">
                <span>{t("tracker.start")}</span>
                <input
                  required
                  type="datetime-local"
                  value={manualForm.startedAt}
                  onChange={(e) =>
                    setManualForm((current) => ({
                      ...current,
                      startedAt: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <label className="grid gap-1 text-sm text-content">
                <span>{t("tracker.end")}</span>
                <input
                  required
                  type="datetime-local"
                  value={manualForm.endedAt}
                  onChange={(e) =>
                    setManualForm((current) => ({
                      ...current,
                      endedAt: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <label className="grid gap-1 text-sm text-content">
                <span>{t("tracker.projectOptional")}</span>
                <select
                  value={manualForm.projectId}
                  onChange={(e) =>
                    setManualForm((current) => ({
                      ...current,
                      projectId: e.target.value,
                    }))
                  }
                  className={selectClass}
                >
                  <option value="">{t("tracker.noProject")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowManualForm(false);
                  setManualForm(emptyManualForm());
                }}
                className={secondaryButtonClass}
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className={primaryButtonClass}
              >
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </form>
        </ResponsiveOverlay>
      )}

      {editing && (
        <ResponsiveOverlay ariaLabel={t("tracker.editEntry")}>
          <form onSubmit={saveEdit} className="w-full">
            <h2 className="text-lg font-semibold">{t("tracker.editEntry")}</h2>

            <div className="mt-4 grid gap-3">
              <DescriptionAutocomplete
                label={t("tracker.description")}
                value={editForm.description}
                required
                onChange={(description) =>
                  setEditForm((current) => ({
                    ...current,
                    description,
                  }))
                }
                onSuggestionSelect={(suggestion) =>
                  setEditForm((current) => ({
                    ...current,
                    description: suggestion.description,
                    projectId: suggestion.projectId ?? "",
                  }))
                }
              />

              <label className="grid gap-1 text-sm text-content">
                <span>{t("tracker.projectOptional")}</span>
                <select
                  value={editForm.projectId}
                  onChange={(e) =>
                    setEditForm((current) => ({
                      ...current,
                      projectId: e.target.value,
                    }))
                  }
                  className={selectClass}
                >
                  <option value="">{t("tracker.noProject")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className={secondaryButtonClass}
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className={primaryButtonClass}
              >
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </form>
        </ResponsiveOverlay>
      )}

      {pendingDelete && (
        <ResponsiveOverlay
          ariaLabel={t("common.delete")}
          labelledBy="delete-entry-title"
          onBackdropClick={closeDeleteDialog}
        >
          <h2 id="delete-entry-title" className="text-lg font-semibold">
            {t("tracker.deleteEntryTitle")}
          </h2>
          <p className={`mt-2 ${metaTextClass}`}>
            {t("tracker.deleteEntryBody")}
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDeleteDialog}
              className={actionButtonClass}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={saving}
              className={destructiveButtonClass}
            >
              {saving ? t("common.deleting") : t("common.confirmDelete")}
            </button>
          </div>
        </ResponsiveOverlay>
      )}
    </PageMain>
  );
}
