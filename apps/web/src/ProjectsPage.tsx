import type { Client, Project } from "@hourden/domain";
import { useCallback, useEffect, useState } from "react";

type ProjectFormData = {
  name: string;
  color: string;
};

const DEFAULT_PROJECT_COLOR = "#3b82f6";

const emptyForm: ProjectFormData = {
  name: "",
  color: DEFAULT_PROJECT_COLOR,
};

function projectToForm(project: Project): ProjectFormData {
  return {
    name: project.name,
    color: project.color ?? DEFAULT_PROJECT_COLOR,
  };
}

async function fetchClients(): Promise<Client[]> {
  const res = await fetch("/api/clients");
  if (!res.ok) {
    throw new Error(`Failed to load clients (${res.status})`);
  }
  const data = (await res.json()) as { clients: Client[] };
  return data.clients;
}

async function fetchProjects(clientId: string): Promise<Project[]> {
  const res = await fetch(`/api/projects?clientId=${encodeURIComponent(clientId)}`);
  if (!res.ok) {
    throw new Error(`Failed to load projects (${res.status})`);
  }
  const data = (await res.json()) as { projects: Project[] };
  return data.projects;
}

export default function ProjectsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [form, setForm] = useState<ProjectFormData>(emptyForm);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    setError(null);
    try {
      setClients(await fetchClients());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoadingClients(false);
    }
  }, []);

  const loadProjects = useCallback(async (clientId: string) => {
    if (!clientId) {
      setProjects([]);
      return;
    }

    setLoadingProjects(true);
    setError(null);
    try {
      setProjects(await fetchProjects(clientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    void loadProjects(selectedClientId);
  }, [loadProjects, selectedClientId]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const openCreate = () => {
    setEditing("new");
    setForm(emptyForm);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    setForm(projectToForm(project));
  };

  const closeForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const saveProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClientId) return;

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      color: form.color.trim() || null,
    };

    try {
      const isNew = editing === "new";
      const res = await fetch(
        isNew
          ? "/api/projects"
          : `/api/projects/${(editing as Project).id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isNew ? { ...payload, clientId: selectedClientId } : payload,
          ),
        },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }

      closeForm();
      await loadProjects(selectedClientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !selectedClientId) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${pendingDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Delete failed (${res.status})`);
      }
      setPendingDelete(null);
      await loadProjects(selectedClientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-neutral-600">
            Work streams under a Client for time tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!selectedClientId}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          New project
        </button>
      </header>

      <label className="grid max-w-sm gap-1 text-sm" htmlFor="project-client-select">
        <span>Client</span>
        <select
          id="project-client-select"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          disabled={loadingClients}
          className="rounded-md border border-neutral-300 px-3 py-2"
        >
          <option value="">Select a client…</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!selectedClientId ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-neutral-500">
          Select a client to view and manage their projects.
        </p>
      ) : loadingProjects ? (
        <p className="text-neutral-500">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-neutral-500">
          No projects yet for {selectedClient?.name ?? "this client"}. Create
          the first project to start logging time.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-start justify-between gap-4 px-4 py-4"
            >
              <div className="flex items-center gap-3">
                {project.color && (
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                    aria-hidden
                  />
                )}
                <p className="font-medium">{project.name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(project)}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(project)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={saveProject}
            className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-lg"
          >
            <h2 className="text-lg font-semibold">
              {editing === "new" ? "New project" : "Edit project"}
            </h2>
            {selectedClient && (
              <p className="mt-1 text-sm text-neutral-600">
                Client: {selectedClient.name}
              </p>
            )}

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span>Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, name: e.target.value }))
                  }
                  className="rounded-md border border-neutral-300 px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Color (optional)</span>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      color: e.target.value,
                    }))
                  }
                  className="h-10 w-full cursor-pointer rounded-md border border-neutral-300"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
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
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Delete project?</h2>
            <p className="mt-2 text-sm text-neutral-600">
              This will permanently delete{" "}
              <strong>{pendingDelete.name}</strong>.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
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
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
