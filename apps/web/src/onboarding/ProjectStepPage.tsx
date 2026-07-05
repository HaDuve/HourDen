import type { Client } from "@hourden/domain";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  cardClass,
  emptyStateClass,
  errorBannerClass,
  fieldLabelClass,
  inputClass,
  metaTextClass,
  primaryButtonClass,
  selectClass,
} from "../layout/ui-classes.js";
import { DEFAULT_PROJECT_COLOR } from "../project-default-color.js";

type ProjectFormData = {
  name: string;
  color: string;
};

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
          setError(t("onboarding.loadClientsFailed"));
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
      setError(t("onboarding.saveProjectFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className={metaTextClass}>{t("onboarding.loading")}</p>;
  }

  if (clients.length === 0) {
    return (
      <section className={`${emptyStateClass} p-6`}>
        <p className={metaTextClass}>{t("onboarding.createClientFirst")}</p>
        <Link
          to="/onboarding/client"
          className={`mt-4 inline-block ${primaryButtonClass}`}
        >
          {t("onboarding.addFirstClient")}
        </Link>
      </section>
    );
  }

  return (
    <section className={`${cardClass} p-6 shadow-sm`}>
      <h2 className="text-lg font-semibold text-content">{t("onboarding.addFirstProject")}</h2>
      <p className={`mt-1 ${metaTextClass}`}>{t("onboarding.addFirstProjectHint")}</p>

      {error ? (
        <p className={`mt-4 ${errorBannerClass}`}>
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
        <label className={`grid gap-1 ${fieldLabelClass}`}>
          <span>{t("onboarding.selectClient")}</span>
          <select
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={selectClass}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

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
          <span>{t("projects.colorOptional")}</span>
          <input
            type="color"
            value={form.color}
            onChange={(e) =>
              setForm((current) => ({ ...current, color: e.target.value }))
            }
            className="h-10 w-20 rounded-md border border-input"
          />
        </label>

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving || !clientId}
            className={primaryButtonClass}
          >
            {saving ? t("common.saving") : t("onboarding.continue")}
          </button>
        </div>
      </form>
    </section>
  );
}
