import type { Client } from "@hourden/domain";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

type ProjectFormData = {
  name: string;
  color: string;
};

const DEFAULT_PROJECT_COLOR = "#3b82f6";

const emptyForm: ProjectFormData = {
  name: "",
  color: DEFAULT_PROJECT_COLOR,
};

async function fetchClients(): Promise<Client[]> {
  const res = await fetch("/api/clients");
  if (!res.ok) {
    throw new Error(`Failed to load clients (${res.status})`);
  }
  const data = (await res.json()) as { clients: Client[] };
  return data.clients;
}

export default function ProjectStepPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(searchParams.get("clientId") ?? "");
  const [form, setForm] = useState<ProjectFormData>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const loadedClients = await fetchClients();
        if (cancelled) {
          return;
        }
        setClients(loadedClients);
        const preferredClientId = searchParams.get("clientId");
        if (preferredClientId && loadedClients.some((c) => c.id === preferredClientId)) {
          setClientId(preferredClientId);
        } else if (loadedClients[0]) {
          setClientId(loadedClients[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("onboarding.loadClientsFailed"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [searchParams, t]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!clientId) {
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      color: form.color.trim() || null,
      clientId,
    };

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }

      navigate("/onboarding/invoice-sender");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboarding.saveProjectFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-neutral-500">{t("onboarding.loading")}</p>;
  }

  if (clients.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center">
        <p className="text-neutral-600">{t("onboarding.createClientFirst")}</p>
        <Link
          to="/onboarding/client"
          className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          {t("onboarding.addFirstClient")}
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{t("onboarding.addFirstProject")}</h2>
      <p className="mt-1 text-sm text-neutral-600">{t("onboarding.addFirstProjectHint")}</p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span>{t("onboarding.selectClient")}</span>
          <select
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2"
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>{t("clients.name")}</span>
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
          <span>{t("projects.colorOptional")}</span>
          <input
            type="color"
            value={form.color}
            onChange={(e) =>
              setForm((current) => ({ ...current, color: e.target.value }))
            }
            className="h-10 w-20 rounded-md border border-neutral-300"
          />
        </label>

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving || !clientId}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? t("common.saving") : t("onboarding.continue")}
          </button>
        </div>
      </form>
    </section>
  );
}
