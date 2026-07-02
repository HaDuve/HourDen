import type { Project, TimeEntry } from "@hourden/domain";
import { useCallback, useEffect, useState } from "react";
import { todayLocalDate } from "./today-date.js";
import { useDeleteDialog } from "./useDeleteDialog.js";

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

function localDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
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

async function fetchEntries(date: string): Promise<TimeEntry[]> {
  const res = await fetch(`/api/time-entries?date=${encodeURIComponent(date)}`);
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

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) {
    throw new Error(`Failed to load projects (${res.status})`);
  }
  const data = (await res.json()) as { projects: Project[] };
  return data.projects;
}

export default function TodayPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
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

  const date = todayLocalDate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedEntries, loadedRunning, loadedProjects] = await Promise.all([
        fetchEntries(date),
        fetchRunningTimer(),
        fetchProjects(),
      ]);
      setEntries(loadedEntries);
      setRunning(loadedRunning);
      setProjects(loadedProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load today");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setError(err instanceof Error ? err.message : "Failed to start timer");
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
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`Stop failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop timer");
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
      setError(err instanceof Error ? err.message : "Failed to save entry");
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
      setError(err instanceof Error ? err.message : "Failed to update entry");
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
      setError(err instanceof Error ? err.message : "Failed to delete entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
          <p className="text-neutral-600">
            {date} — track time with a running timer or manual entries.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowManualForm(true)}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Add manual entry
          </button>
          {running ? (
            <button
              type="button"
              onClick={() => void stopTimer()}
              disabled={saving}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              Stop timer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startTimer()}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Start timer
            </button>
          )}
        </div>
      </header>

      {running && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Timer running — {formatDuration(running.durationMinutes)}
          {running.description ? ` · ${running.description}` : (
            <span className="ml-2 text-emerald-700">(add description when done)</span>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-neutral-500">Loading entries…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-neutral-500">
          No time logged today yet. Start a timer or add a manual entry.
        </p>
      ) : (
        <ul
          className={`divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white${
            isDeleteDialogOpen ? " pointer-events-none" : ""
          }`}
        >
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-4 px-4 py-4"
            >
              <div>
                <p className="font-medium">
                  {entry.description?.trim() || (
                    <span className="text-neutral-400 italic">No description</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  {formatDuration(entry.durationMinutes)}
                  {entry.isRunning && " · running"}
                  {entry.amount !== null && ` · ${entry.amount} €`}
                  {!entry.billableComplete && !entry.isRunning && " · incomplete"}
                </p>
              </div>
              {!entry.invoiced && !entry.isRunning && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(entry)}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteDialog(entry)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {showManualForm && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={saveManualEntry}
            className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-lg"
          >
            <h2 className="text-lg font-semibold">Manual entry</h2>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>Description</span>
                <input
                  required
                  value={manualForm.description}
                  onChange={(e) =>
                    setManualForm((current) => ({
                      ...current,
                      description: e.target.value,
                    }))
                  }
                  className="rounded-md border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Start</span>
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
                  className="rounded-md border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>End</span>
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
                  className="rounded-md border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Project (optional)</span>
                <select
                  value={manualForm.projectId}
                  onChange={(e) =>
                    setManualForm((current) => ({
                      ...current,
                      projectId: e.target.value,
                    }))
                  }
                  className="rounded-md border border-neutral-300 px-3 py-2"
                >
                  <option value="">No project</option>
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
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={saveEdit}
            className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-lg"
          >
            <h2 className="text-lg font-semibold">Edit entry</h2>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>Description</span>
                <input
                  required
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((current) => ({
                      ...current,
                      description: e.target.value,
                    }))
                  }
                  className="rounded-md border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Project (optional)</span>
                <select
                  value={editForm.projectId}
                  onChange={(e) =>
                    setEditForm((current) => ({
                      ...current,
                      projectId: e.target.value,
                    }))
                  }
                  className="rounded-md border border-neutral-300 px-3 py-2"
                >
                  <option value="">No project</option>
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
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-entry-title"
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-lg">
            <h2 id="delete-entry-title" className="text-lg font-semibold">
              Delete entry?
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              This will permanently delete this time entry.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteDialog}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={saving}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Deleting…" : "Confirm delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
