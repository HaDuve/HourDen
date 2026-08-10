import { groupTrackerEntriesByMonth, type Client, type Project, type TimeEntry, type UpdateTimeEntryInput } from "@hourden/domain";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageMain } from "./layout/PageMain.js";
import { ResponsiveOverlay } from "./layout/ResponsiveOverlay.js";
import {
  mobileActionButtonClass,
} from "./layout/tap-targets.js";
import {
  destructiveButtonClass,
  emptyStateClass,
  errorBannerClass,
  listPanelClass,
  metaTextClass,
  numericMetaValueClass,
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
import { formatEntryTime } from "./tracker/formatEntryTime.js";
import { groupProjectsByClient } from "./tracker/groupProjectsByClient.js";
import {
  TrackerEntryEditForm,
  entryToEditForm,
  toEditPatch,
  type TrackerEntryEditFormData,
} from "./tracker/TrackerEntryEditForm.js";
import { TrackerEntryRow } from "./tracker/TrackerEntryRow.js";
import { TrackerTimerBar } from "./tracker/TrackerTimerBar.js";
import { useLiveCounter } from "./tracker/useLiveCounter.js";
import { todayDateInTimeZone } from "./today-date.js";
import { useDeleteDialog } from "./useDeleteDialog.js";
import { useRunningTimer } from "./running-timer/RunningTimerContext.js";
import { useWorkspaceEvents } from "./useWorkspaceEvents.js";

type EditFormData = TrackerEntryEditFormData;

function durationFromEditForm(form: EditFormData): number {
  const start = new Date(form.startedAt).getTime();
  const end = new Date(form.endedAt).getTime();
  if (end <= start) {
    return 0;
  }
  return Math.round((end - start) / 60_000);
}

type BarFormData = {
  description: string;
  projectId: string;
  startedAt: string;
  endedAt: string;
};

function emptyBarForm(): BarFormData {
  return {
    description: "",
    projectId: "",
    startedAt: "",
    endedAt: "",
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
  const { running, refresh: refreshRunningTimer, replaceRunning, suppressRemoteStopNotice } = useRunningTimer();
  const [calendarTimezone, setCalendarTimezone] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [entryLimit, setEntryLimit] = useState<TrackerEntryLimit>(
    readStoredTrackerEntryLimit(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    startedAt: "",
    endedAt: "",
  });
  const [barForm, setBarForm] = useState<BarFormData>(emptyBarForm);

  const liveCounter = useLiveCounter(running?.startedAt ?? null);
  const projectGroups = useMemo(
    () => groupProjectsByClient(projects, clients),
    [projects, clients],
  );
  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
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
      const [loadedEntries, loadedProjects, loadedClients] = await Promise.all([
          fetchTrackerEntries(entryLimit),
          fetchProjects(),
          fetchClients(),
        ]);
      setEntries(loadedEntries);
      setProjects(loadedProjects);
      setClients(loadedClients);
    } catch {
      setError(t("tracker.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [calendarTimezone, entryLimit, t]);

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
      void refreshEntries();
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
      startedAt: "",
      endedAt: "",
    });
  }, [running?.id]);

  const patchEntry = async (entryId: string, patch: UpdateTimeEntryInput) => {
    setError(null);
    const res = await fetch(`/api/time-entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      const message = body?.error ?? t("tracker.saveFailed");
      setError(message);
      throw new Error(message);
    }
    const updated = (await res.json()) as TimeEntry;
    setEntries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
    return updated;
  };

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
      replaceRunning(updated);
      setBarForm((current) => ({
        description:
          patch.description !== undefined ? patch.description : current.description,
        projectId: updated.projectId ?? "",
        startedAt: current.startedAt,
        endedAt: current.endedAt,
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
    if (barForm.endedAt && !barForm.startedAt) {
      setError(t("tracker.startRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    suppressRemoteStopNotice();
    try {
      const body: {
        description: string | null;
        projectId: string | null;
        startedAt?: string;
      } = {
        description: barForm.description.trim() || null,
        projectId: barForm.projectId || null,
      };
      if (barForm.startedAt) {
        body.startedAt = new Date(barForm.startedAt).toISOString();
      }

      const res = await fetch("/api/time-entries/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Start failed (${res.status})`);
      }
      setBarForm((current) => ({
        ...current,
        startedAt: "",
        endedAt: "",
      }));
      await load();
      await refreshRunningTimer();
    } catch {
      setError(t("tracker.startFailed"));
    } finally {
      setSaving(false);
    }
  };

  const stopTimer = async (endedAt?: string) => {
    if (!running) return;

    setSaving(true);
    setError(null);
    suppressRemoteStopNotice();
    try {
      const body: { description?: string; endedAt?: string } = {
        description: barForm.description.trim() || undefined,
      };
      if (endedAt) {
        body.endedAt = new Date(endedAt).toISOString();
      }

      const res = await fetch(`/api/time-entries/${running.id}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const responseBody = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        const message = responseBody?.error ?? t("tracker.stopFailed");
        setError(message);
        throw new Error(message);
      }
      setBarForm((current) => ({
        ...current,
        startedAt: "",
        endedAt: "",
      }));
      await load();
      await refreshRunningTimer();
    } catch {
      setError((current) => current ?? t("tracker.stopFailed"));
    } finally {
      setSaving(false);
    }
  };

  const saveManualEntry = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: barForm.description.trim(),
          startedAt: new Date(barForm.startedAt).toISOString(),
          endedAt: new Date(barForm.endedAt).toISOString(),
          projectId: barForm.projectId || null,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        const message = body?.error ?? t("tracker.saveFailed");
        setError(message);
        throw new Error(message);
      }

      setBarForm(emptyBarForm());
      await load();
    } catch {
      // Error banner already set for API failures; network failures fall through.
      setError((current) => current ?? t("tracker.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleStartedAtChange = (startedAt: string) => {
    if (saving) return;
    setBarForm((current) => ({ ...current, startedAt }));
    if (running && startedAt) {
      void patchEntry(running.id, {
        startedAt: new Date(startedAt).toISOString(),
      }).then((updated) => {
        replaceRunning(updated);
      }).catch(() => {
        // Error banner already set by patchEntry.
      });
    }
  };

  const handleEndedAtChange = (endedAt: string) => {
    if (saving) return;
    setBarForm((current) => ({ ...current, endedAt }));
    if (running && endedAt) {
      if (new Date(endedAt).getTime() <= new Date(running.startedAt).getTime()) {
        setError(t("tracker.invalidRange"));
        return;
      }
      void stopTimer(endedAt);
    }
  };

  const openMobileEdit = (entry: TimeEntry) => {
    setEditing(entry);
    setEditForm(entryToEditForm(entry));
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    setSaving(true);
    setError(null);
    try {
      await patchEntry(editing.id, toEditPatch(editForm, editing));
      setEditing(null);
    } catch {
      // Error banner already set by patchEntry.
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
  const monthGroups =
    calendarTimezone && today
      ? groupTrackerEntriesByMonth(entries, {
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
      </header>

      <TrackerTimerBar
        running={running}
        liveCounter={liveCounter}
        description={barForm.description}
        projectId={barForm.projectId}
        projectGroups={projectGroups}
        saving={saving}
        startedAt={barForm.startedAt}
        endedAt={barForm.endedAt}
        onDescriptionChange={(description) =>
          setBarForm((current) => ({ ...current, description }))
        }
        onDescriptionSuggestionSelect={(suggestion) => {
          setBarForm((current) => ({
            ...current,
            description: suggestion.description,
            projectId: suggestion.projectId ?? "",
          }));
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
        onStartedAtChange={handleStartedAtChange}
        onEndedAtChange={handleEndedAtChange}
        onStart={() => void startTimer()}
        onStop={() => void stopTimer()}
        onAddManual={() => void saveManualEntry()}
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
          {monthGroups.map((month) => (
            <section key={month.monthKey}>
              <div className="mb-2 flex items-baseline justify-between gap-4 px-1">
                <h2 className="text-sm font-semibold text-content">{month.monthLabel}</h2>
                <p className={numericMetaValueClass}>
                  {t("tracker.monthTotal")}: {formatDurationMinutes(month.totalDurationMinutes)}
                </p>
              </div>

              <div className="space-y-4">
                {month.days.map((day) => (
                  <div key={day.date}>
                    <div className="mb-1 flex items-baseline justify-between gap-4 border-b border-divider px-4 py-2">
                      <h3 className="text-sm font-medium text-content">{day.dayLabel}</h3>
                      <p className={numericMetaValueClass}>
                        {t("tracker.dayTotal")}: {formatDurationMinutes(day.totalDurationMinutes)}
                      </p>
                    </div>

                    <ul className={listPanelClass}>
                      {day.entries.map((entry) => (
                        <TrackerEntryRow
                          key={entry.id}
                          entry={entry}
                          projectName={
                            entry.projectId
                              ? (projectNameById.get(entry.projectId) ?? null)
                              : null
                          }
                          projectGroups={projectGroups}
                          isMobile={isMobile}
                          formatDurationMinutes={formatDurationMinutes}
                          formatCurrency={formatCurrency}
                          formatDateTime={(iso) => formatEntryTime(iso, locale)}
                          saving={saving}
                          onPatch={async (patch) => {
                            await patchEntry(entry.id, patch);
                          }}
                          onDelete={() => openDeleteDialog(entry)}
                          onMobileEdit={() => openMobileEdit(entry)}
                        />
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

      {editing && isMobile && (
        <ResponsiveOverlay ariaLabel={t("tracker.editEntry")}>
          <TrackerEntryEditForm
            form={editForm}
            durationMinutes={durationFromEditForm(editForm)}
            projectGroups={projectGroups}
            saving={saving}
            formatDurationMinutes={formatDurationMinutes}
            onChange={setEditForm}
            onSubmit={saveEdit}
            onCancel={() => setEditing(null)}
          />
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
