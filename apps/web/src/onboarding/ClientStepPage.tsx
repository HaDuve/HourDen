import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

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

export default function ClientStepPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState<ClientFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
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
      const res = await fetch("/api/clients", {
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

      const client = (await res.json()) as { id: string };
      navigate(`/onboarding/project?clientId=${encodeURIComponent(client.id)}`);
    } catch (err) {
      setError(t("onboarding.saveClientFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{t("onboarding.addFirstClient")}</h2>
      <p className="mt-1 text-sm text-neutral-600">{t("onboarding.addFirstClientHint")}</p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
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
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
        </label>

        <fieldset className="grid gap-3 rounded-md border border-neutral-200 p-3">
          <legend className="px-1 text-sm font-medium">
            {t("clients.recipientOptional")}
          </legend>
          <label className="grid gap-1 text-sm">
            <span>{t("clients.legalName")}</span>
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
            <span>{t("clients.addressLine1")}</span>
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
            <span>{t("clients.addressLine2")}</span>
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

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? t("common.saving") : t("onboarding.continue")}
          </button>
        </div>
      </form>
    </section>
  );
}
