import type { Client } from "@hourden/domain";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
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
  fieldLabelClass,
  inputClass,
  listPanelClass,
  metaTextClass,
  numericMetaValueClass,
  pageSubtitleClass,
  pageTitleLargeClass,
  secondaryButtonClass,
} from "./layout/ui-classes.js";
import { useIsMobile } from "./layout/use-is-mobile.js";
import { useDeleteDialog } from "./useDeleteDialog.js";
import { useLocaleFormat } from "./locale/use-locale-format.js";

type ClientFormData = {
  name: string;
  defaultRate: string;
  legalName: string;
  addressLine1: string;
  addressLine2: string;
};

const emptyForm: ClientFormData = {
  name: "",
  defaultRate: "",
  legalName: "",
  addressLine1: "",
  addressLine2: "",
};

function clientToForm(client: Client): ClientFormData {
  return {
    name: client.name,
    defaultRate: String(client.defaultRate),
    legalName: client.legalName ?? "",
    addressLine1: client.addressLine1 ?? "",
    addressLine2: client.addressLine2 ?? "",
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

export default function ClientsPage() {
  const { t } = useTranslation();
  const { formatHourlyRate } = useLocaleFormat();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [form, setForm] = useState<ClientFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const {
    pendingDelete,
    isDeleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    getDeleteTargetId,
  } = useDeleteDialog<Client>();

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClients(await fetchClients());
    } catch (err) {
      setError(t("clients.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const editId = searchParams.get("edit");
    const wantsNew = searchParams.get("new") === "1";
    if (!editId && !wantsNew) {
      return;
    }

    if (editId) {
      const client = clients.find((entry) => entry.id === editId);
      if (client) {
        setEditing(client);
        setForm(clientToForm(client));
      } else {
        setError(t("clients.editClientNotFound"));
      }
    } else {
      setEditing("new");
      setForm(emptyForm);
    }

    setSearchParams({}, { replace: true });
  }, [clients, loading, searchParams, setSearchParams, t]);

  const openCreate = () => {
    setEditing("new");
    setForm(emptyForm);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setForm(clientToForm(client));
  };

  const closeForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const saveClient = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      defaultRate: Number(form.defaultRate),
      legalName: form.legalName.trim() || null,
      addressLine1: form.addressLine1.trim() || null,
      addressLine2: form.addressLine2.trim() || null,
    };

    try {
      const isNew = editing === "new";
      const res = await fetch(
        isNew ? "/api/clients" : `/api/clients/${(editing as Client).id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }

      closeForm();
      await loadClients();
    } catch (err) {
      setError(t("clients.saveFailed"));
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
      const res = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `Delete failed (${res.status})`);
      }
      closeDeleteDialog();
      await loadClients();
    } catch (err) {
      setError(t("clients.deleteFailed"));
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
          <h1 className={pageTitleLargeClass}>{t("clients.title")}</h1>
          <p className={pageSubtitleClass}>{t("clients.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className={primaryButtonClass}
        >
          {t("clients.newClient")}
        </button>
      </header>

      {error && (
        <p className={errorBannerClass}>
          {error}
        </p>
      )}

      {loading ? (
        <p className={metaTextClass}>{t("clients.loading")}</p>
      ) : clients.length === 0 ? (
        <p className={emptyStateClass}>
          {t("clients.empty")}
        </p>
      ) : (
        <ul
          className={`${listPanelClass}${
            isDeleteDialogOpen ? " pointer-events-none" : ""
          }`}
        >
          {clients.map((client) => (
            <li
              key={client.id}
              data-testid="client-card"
              className={`px-4 py-4 ${
                isMobile
                  ? "flex flex-col gap-3"
                  : "flex items-start justify-between gap-4"
              }`}
            >
              {isMobile ? (
                <dl className="grid gap-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t("clients.name")}</dt>
                    <dd className="text-right font-medium">{client.name}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t("clients.defaultRate")}</dt>
                    <dd className={numericMetaValueClass}>
                      {formatHourlyRate(client.defaultRate)}
                    </dd>
                  </div>
                  {client.legalName && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">{t("clients.recipient")}</dt>
                      <dd className="text-right text-xs text-muted">
                        {client.legalName}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className={`text-sm ${numericMetaValueClass}`}>
                    {formatHourlyRate(client.defaultRate)}
                  </p>
                  {client.legalName && (
                    <p className="mt-1 text-xs text-muted">
                      {t("clients.recipientPrefix", { name: client.legalName })}
                    </p>
                  )}
                </div>
              )}
              <div className={`flex gap-2 ${isMobile ? "w-full" : ""}`}>
                <button
                  type="button"
                  onClick={() => openEdit(client)}
                  className={`${actionButtonClass}${
                    isMobile ? " flex-1" : ""
                  }`}
                >
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteDialog(client)}
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
          ariaLabel={editing === "new" ? t("clients.newClient") : t("clients.editClient")}
        >
          <form onSubmit={saveClient} className="w-full">
            <h2 className="text-lg font-semibold">
              {editing === "new" ? t("clients.newClient") : t("clients.editClient")}
            </h2>

            <div className="mt-4 grid gap-3">
              <label className={`grid gap-1 ${fieldLabelClass}`}>
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

              <label className={`grid gap-1 ${fieldLabelClass}`}>
                <span>{t("clients.defaultRate")}</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.defaultRate}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      defaultRate: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <fieldset className="grid gap-3 rounded-md border border-divider p-3">
                <legend className={`px-1 ${fieldLabelClass}`}>
                  {t("clients.recipientOptional")}
                </legend>
                <label className={`grid gap-1 ${fieldLabelClass}`}>
                  <span>{t("clients.legalName")}</span>
                  <input
                    value={form.legalName}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        legalName: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className={`grid gap-1 ${fieldLabelClass}`}>
                  <span>{t("clients.addressLine1")}</span>
                  <input
                    value={form.addressLine1}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        addressLine1: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className={`grid gap-1 ${fieldLabelClass}`}>
                  <span>{t("clients.addressLine2")}</span>
                  <input
                    value={form.addressLine2}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        addressLine2: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
              </fieldset>
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
          labelledBy="delete-client-title"
          onBackdropClick={closeDeleteDialog}
        >
          <h2 id="delete-client-title" className="text-lg font-semibold">
            {t("clients.deleteTitle")}
          </h2>
          <p className={`mt-2 ${metaTextClass}`}>
            {t("clients.deleteBody", { name: pendingDelete.name })}
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
