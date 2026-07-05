import type { Client } from "@hourden/domain";
import { useCallback, useEffect, useState } from "react";
import { PageMain } from "./layout/PageMain.js";
import { ResponsiveOverlay } from "./layout/ResponsiveOverlay.js";
import {
  mobileActionButtonClass,
  mobilePrimaryButtonClass,
} from "./layout/tap-targets.js";
import { useIsMobile } from "./layout/use-is-mobile.js";
import { useDeleteDialog } from "./useDeleteDialog.js";

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
      setError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

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
      setError(err instanceof Error ? err.message : "Failed to save client");
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
      setError(err instanceof Error ? err.message : "Failed to delete client");
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
          <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
          <p className="text-neutral-600">
            Billable organizations and their default rates.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className={`${primaryButtonClass} bg-slate-900 text-white hover:bg-slate-800`}
        >
          New client
        </button>
      </header>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-neutral-500">Loading clients…</p>
      ) : clients.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-neutral-500">
          No clients yet. Create your first client to start tracking billable
          work.
        </p>
      ) : (
        <ul
          className={`divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white${
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
                    <dt className="text-neutral-500">Name</dt>
                    <dd className="text-right font-medium">{client.name}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-500">Default rate</dt>
                    <dd className="text-right text-neutral-600">
                      {client.defaultRate} €/h
                    </dd>
                  </div>
                  {client.legalName && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Recipient</dt>
                      <dd className="text-right text-xs text-neutral-500">
                        {client.legalName}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-sm text-neutral-600">
                    {client.defaultRate} €/h
                  </p>
                  {client.legalName && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Recipient: {client.legalName}
                    </p>
                  )}
                </div>
              )}
              <div className={`flex gap-2 ${isMobile ? "w-full" : ""}`}>
                <button
                  type="button"
                  onClick={() => openEdit(client)}
                  className={`${actionButtonClass} border-neutral-300 hover:bg-neutral-50${
                    isMobile ? " flex-1" : ""
                  }`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteDialog(client)}
                  className={`${actionButtonClass} border-red-200 text-red-700 hover:bg-red-50${
                    isMobile ? " flex-1" : ""
                  }`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ResponsiveOverlay ariaLabel={editing === "new" ? "New client" : "Edit client"}>
          <form onSubmit={saveClient} className="w-full">
            <h2 className="text-lg font-semibold">
              {editing === "new" ? "New client" : "Edit client"}
            </h2>

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
                <span>Default rate (€/h)</span>
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
                  className="rounded-md border border-neutral-300 px-3 py-2"
                />
              </label>

              <fieldset className="grid gap-3 rounded-md border border-neutral-200 p-3">
                <legend className="px-1 text-sm font-medium">
                  Recipient (optional)
                </legend>
                <label className="grid gap-1 text-sm">
                  <span>Legal name</span>
                  <input
                    value={form.legalName}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        legalName: e.target.value,
                      }))
                    }
                    className="rounded-md border border-neutral-300 px-3 py-2"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>Address line 1</span>
                  <input
                    value={form.addressLine1}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        addressLine1: e.target.value,
                      }))
                    }
                    className="rounded-md border border-neutral-300 px-3 py-2"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>Address line 2</span>
                  <input
                    value={form.addressLine2}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        addressLine2: e.target.value,
                      }))
                    }
                    className="rounded-md border border-neutral-300 px-3 py-2"
                  />
                </label>
              </fieldset>
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
        </ResponsiveOverlay>
      )}

      {pendingDelete && (
        <ResponsiveOverlay
          ariaLabel="Delete client"
          labelledBy="delete-client-title"
          onBackdropClick={closeDeleteDialog}
        >
          <h2 id="delete-client-title" className="text-lg font-semibold">
            Delete client?
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            This will permanently delete <strong>{pendingDelete.name}</strong>.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDeleteDialog}
              className={`${actionButtonClass} border-neutral-300`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={saving}
              className={`${actionButtonClass} bg-red-600 font-medium text-white disabled:opacity-60`}
            >
              {saving ? "Deleting…" : "Confirm delete"}
            </button>
          </div>
        </ResponsiveOverlay>
      )}
    </PageMain>
  );
}
