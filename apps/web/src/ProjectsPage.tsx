import type { Client, Project } from "@hourden/domain";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageMain } from "./layout/PageMain.js";
import { ResponsiveOverlay } from "./layout/ResponsiveOverlay.js";
import {
  mobileActionButtonClass,
  mobilePrimaryButtonClass,
} from "./layout/tap-targets.js";
import {
  destructiveButtonClass,
  destructiveOutlineButtonClass,
  emptyStateClass,
  errorBannerClass,
  inputClass,
  listPanelClass,
  metaTextClass,
  pageSubtitleClass,
  pageTitleLargeClass,
  secondaryButtonClass,
  selectClass,
} from "./layout/ui-classes.js";
import { useIsMobile } from "./layout/use-is-mobile.js";
import { useDeleteDialog } from "./useDeleteDialog.js";
import { DEFAULT_PROJECT_COLOR } from "./project-default-color.js";

type ProjectFormData = {
  name: string;
  color: string;
};

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
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [form, setForm] = useState<ProjectFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const {
    pendingDelete,
    isDeleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    getDeleteTargetId,
  } = useDeleteDialog<Project>();

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    setError(null);
    try {
      setClients(await fetchClients());
    } catch (err) {
      setError(t("projects.loadClientsFailed"));
    } finally {
      setLoadingClients(false);
    }
  }, [t]);

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
      setError(t("projects.loadFailed"));
    } finally {
      setLoadingProjects(false);
    }
  }, [t]);

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
      setError(t("projects.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const id = getDeleteTargetId();
    if (!id || !selectedClientId) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Delete failed (${res.status})`);
      }
      closeDeleteDialog();
      await loadProjects(selectedClientId);
    } catch (err) {
      setError(t("projects.deleteFailed"));
    } finally {
      setSaving(false);
    }
  };

  const isMobile = useIsMobile();
  const actionButtonClass = mobileActionButtonClass(isMobile);
  const primaryButtonClass = mobilePrimaryButtonClass(isMobile);

  return (
    <PageMain variant="flex">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={pageTitleLargeClass}>{t("projects.title")}</h1>
          <p className={pageSubtitleClass}>{t("projects.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!selectedClientId}
          className={primaryButtonClass}
        >
          {t("projects.newProject")}
        </button>
      </header>

      <label className="grid max-w-sm gap-1 text-sm" htmlFor="project-client-select">
        <span>{t("projects.client")}</span>
        <select
          id="project-client-select"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          disabled={loadingClients}
          className={selectClass}
        >
          <option value="">{t("projects.selectClient")}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className={errorBannerClass}>
          {error}
        </p>
      )}

      {!selectedClientId ? (
        <p className={emptyStateClass}>
          {t("projects.selectClientPrompt")}
        </p>
      ) : loadingProjects ? (
        <p className={metaTextClass}>{t("projects.loading")}</p>
      ) : projects.length === 0 ? (
        <p className={emptyStateClass}>
          {t("projects.empty", {
            clientName: selectedClient?.name ?? t("projects.thisClient"),
          })}
        </p>
      ) : (
        <ul
          className={`${listPanelClass}${
            isDeleteDialogOpen ? " pointer-events-none" : ""
          }`}
        >
          {projects.map((project) => (
            <li
              key={project.id}
              data-testid="project-card"
              className={`px-4 py-4 ${
                isMobile
                  ? "flex flex-col gap-3"
                  : "flex items-start justify-between gap-4"
              }`}
            >
              {isMobile ? (
                <dl className="grid gap-1 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">{t("clients.name")}</dt>
                    <dd className="flex items-center gap-2 font-medium">
                      {project.color && (
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: project.color }}
                          aria-hidden
                        />
                      )}
                      {project.name}
                    </dd>
                  </div>
                </dl>
              ) : (
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
              )}
              <div className={`flex gap-2 ${isMobile ? "w-full" : ""}`}>
                <button
                  type="button"
                  onClick={() => openEdit(project)}
                  className={`${actionButtonClass}${
                    isMobile ? " flex-1" : ""
                  }`}
                >
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteDialog(project)}
                  className={`${destructiveOutlineButtonClass}${
                    isMobile ? " min-h-11 flex-1 px-4 text-sm" : " px-3 py-1.5 text-sm"
                  }`}
                >
                  {t("common.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ResponsiveOverlay
          ariaLabel={
            editing === "new" ? t("projects.newProject") : t("projects.editProject")
          }
        >
          <form onSubmit={saveProject} className="w-full">
            <h2 className="text-lg font-semibold">
              {editing === "new" ? t("projects.newProject") : t("projects.editProject")}
            </h2>
            {selectedClient && (
              <p className={`mt-1 ${metaTextClass}`}>
                {t("projects.clientLabel", { name: selectedClient.name })}
              </p>
            )}

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm text-content">
                <span>{t("clients.name")}</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, name: e.target.value }))
                  }
                  className={inputClass}
                />
              </label>

              <label className="grid gap-1 text-sm text-content">
                <span>{t("projects.colorOptional")}</span>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      color: e.target.value,
                    }))
                  }
                  className="h-10 w-full cursor-pointer rounded-md border border-input"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
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
          labelledBy="delete-project-title"
          onBackdropClick={closeDeleteDialog}
        >
          <h2 id="delete-project-title" className="text-lg font-semibold">
            {t("projects.deleteTitle")}
          </h2>
          <p className={`mt-2 ${metaTextClass}`}>
            {t("projects.deleteBody", { name: pendingDelete.name })}
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
