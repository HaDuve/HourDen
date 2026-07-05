import { groupTrackerEntriesByWeek, type Client, type Project, type TimeEntry } from "@hourden/domain";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageMain } from "./layout/PageMain.js";
import { ResponsiveOverlay } from "./layout/ResponsiveOverlay.js";
import {
  mobileActionButtonClass,
  mobilePrimaryButtonClass,
  mobileSecondaryButtonClass,
} from "./layout/tap-targets.js";
import {
  destructiveButtonClass,
  destructiveOutlineButtonClass,
  emptyStateClass,
  errorBannerClass,
  inputClass,
  listPanelClass,
  metaTextClass,
  numericMetaValueClass,
  numericValueClass,
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
import { groupProjectsByClient } from "./tracker/groupProjectsByClient.js";
import { TrackerTimerBar } from "./tracker/TrackerTimerBar.js";
import { useLiveCounter } from "./tracker/useLiveCounter.js";
import { todayDateInTimeZone } from "./today-date.js";
import { useDeleteDialog } from "./useDeleteDialog.js";
import { useWorkspaceEvents } from "./useWorkspaceEvents.js";
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

type BarFormData = {
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

async function fetchClients(): Promise<Client[]> {
  const res = await fetch("/api/clients");
  if (!res.ok) {
    throw new Error(`Failed to load clients (${res.status})`);
  }
  const data = (await res.json()) as { clients: Client[] };
  return data.clients;
}

export default function TrackerPage() {
  const { t } = useTranslation();
  const { locale, formatCurrency, formatDurationMinutes } = useLocaleFormat();
  const [calendarTimezone, setCalendarTimezone] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
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
  const [barForm, setBarForm] = useState<BarFormData>({
    description: "",
    projectId: "",
  });

  const liveCounter = useLiveCounter(running?.startedAt ?? null);
  const projectGroups = useMemo(
    () => groupProjectsByClient(projects, clients),
    [projects, clients],
  );

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
      .catch(() => {
        if (!cancelled) {
          setError(t("tracker.loadFailed"));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const load = useCallback(async () => {
    if (!calendarTimezone) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [loadedEntries, loadedRunning, loadedProjects, loadedClients] =
        await Promise.all([
          fetchTrackerEntries(entryLimit),
          fetchRunningTimer(),
          fetchProjects(),
          fetchClients(),
        ]);
      setEntries(loadedEntries);
      setRunning(loadedRunning);
      setProjects(loadedProjects);
      setClients(loadedClients);
    } catch {
      setError(t("tracker.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [calendarTimezone, entryLimit, t]);

  const refreshRunningTimer = useCallback(async () => {
    try {
      const loadedRunning = await fetchRunningTimer();
      setRunning(loadedRunning);
    } catch {
      setError(t("tracker.loadFailed"));
    }
  }, [t]);

  const refreshEntries = useCallback(async () => {
    try {
      const loadedEntries = await fetchTrackerEntries(entryLimit);
      setEntries(loadedEntries);
    } catch {
      setError(t("tracker.loadFailed"));
    }
  }, [entryLimit, t]);

  useWorkspaceEvents({
    "timer-changed": () => {
      void refreshRunningTimer();
    },
    "today-changed": () => {
      void refreshEntries();
    },
  });

  useEffect(() => {
    if (calendarTimezone) {
      void load();
    }
  }, [calendarTimezone, load]);

  useEffect(() => {
    if (!running) {
      return;
    }

    setBarForm({
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
        body.description = barForm.description.trim() || null;
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
      setBarForm((current) => ({
        description:
          patch.description !== undefined ? patch.description : current.description,
        projectId: updated.projectId ?? "",
      }));
    } catch {
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
        body: JSON.stringify({
          description: barForm.description.trim() || null,
          projectId: barForm.projectId || null,
        }),
      });
      if (!res.ok) {
        throw new Error(`Start failed (${res.status})`);
      }
      await load();
    } catch {
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
          description: barForm.description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(`Stop failed (${res.status})`);
      }
      await load();
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
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
        <button
          type="button"
          onClick={() => setShowManualForm(true)}
          className={secondaryButtonClass}
        >
          {t("tracker.addManualEntry")}
        </button>
      </header>

      <TrackerTimerBar
        running={running}
        liveCounter={liveCounter}
        description={barForm.description}
        projectId={barForm.projectId}
        projectGroups={projectGroups}
        saving={saving}
        onDescriptionChange={(description) =>
          setBarForm((current) => ({ ...current, description }))
        }
        onDescriptionSuggestionSelect={(suggestion) => {
          setBarForm({
            description: suggestion.description,
            projectId: suggestion.projectId ?? "",
          });
          if (running) {
            void patchRunningEntry({
              description: suggestion.description,
              projectId: suggestion.projectId,
            });
          }
        }}
        onProjectChange={(projectId) => {
          setBarForm((current) => ({ ...current, projectId }));
          if (running) {
            void patchRunningEntry({ projectId: projectId || null });
          }
        }}
        onStart={() => void startTimer()}
        onStop={() => void stopTimer()}
      />

      {error && <p className={errorBannerClass}>{error}</p>}

      {loading ? (
        <p className={metaTextClass}>{t("tracker.loading")}</p>
      ) : entries.length === 0 ? (
        <p className={emptyStateClass}>{t("tracker.empty")}</p>
      ) : (
        <div
          className={`space-y-6${isDeleteDialogOpen ? " pointer-events-none" : ""}`}
        >
          {weekGroups.map((week) => (
            <section key={week.weekStart}>
              <div className="mb-2 flex items-baseline justify-between gap-4 px-1">
                <h2 className="text-sm font-semibold text-content">{week.weekLabel}</h2>
                <p className={numericMetaValueClass}>
                  {t("tracker.weekTotal")}: {formatDurationMinutes(week.totalDurationMinutes)}
                </p>
              </div>

              <div className="space-y-4">
                {week.days.map((day) => (
                  <div key={day.date}>
                    <div className="mb-1 flex items-baseline justify-between gap-4 border-b border-divider px-4 py-2">
                      <h3 className="text-sm font-medium text-content">{day.dayLabel}</h3>
                      <p className={numericMetaValueClass}>
                        {t("tracker.dayTotal")}: {formatDurationMinutes(day.totalDurationMinutes)}
                      </p>
                    </div>

                    <ul className={listPanelClass}>
                      {day.entries.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-start justify-between gap-4 px-4 py-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-content">
                              {entry.description?.trim() || (
                                <span className="text-muted italic">
                                  {t("tracker.noDescription")}
                                </span>
                              )}
                            </p>
                            {(entry.amount !== null ||
                              (!entry.billableComplete && !entry.isRunning)) && (
                              <p className={`mt-1 ${metaTextClass}`}>
                                {entry.amount !== null && formatCurrency(entry.amount)}
                                {!entry.billableComplete &&
                                  !entry.isRunning &&
                                  `${entry.amount !== null ? " · " : ""}${t("tracker.incomplete")}`}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-start gap-3">
                            <p className={`${numericValueClass} text-sm`}>
                              {formatDurationMinutes(entry.durationMinutes)}
                              {entry.isRunning && (
                                <span className={`block ${metaTextClass}`}>
                                  {t("tracker.running")}
                                </span>
                              )}
                            </p>
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
                          </div>
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
            <h2 className="text-lg font-semibold text-content">{t("tracker.manualEntry")}</h2>

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
            <h2 className="text-lg font-semibold text-content">{t("tracker.editEntry")}</h2>

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
          <h2 id="delete-entry-title" className="text-lg font-semibold text-content">
            {t("tracker.deleteEntryTitle")}
          </h2>
          <p className={`mt-2 ${metaTextClass}`}>{t("tracker.deleteEntryBody")}</p>
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
