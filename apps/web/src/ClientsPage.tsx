import type { Client } from "@hourden/domain";
import { useCallback, useEffect, useState } from "react";

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
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (!pendingDelete) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${pendingDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Delete failed (${res.status})`);
      }
      setPendingDelete(null);
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete client");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
          <p className="text-neutral-600">
            Billable organizations and their default rates.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
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
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {clients.map((client) => (
            <li
              key={client.id}
              className="flex items-start justify-between gap-4 px-4 py-4"
            >
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(client)}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(client)}
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
            onSubmit={saveClient}
            className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-lg"
          >
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
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Delete client?</h2>
            <p className="mt-2 text-sm text-neutral-600">
              This will permanently delete <strong>{pendingDelete.name}</strong>.
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
