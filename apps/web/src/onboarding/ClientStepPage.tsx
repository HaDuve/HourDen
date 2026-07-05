import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  cardClass,
  errorBannerClass,
  fieldLabelClass,
  inputClass,
  metaTextClass,
  primaryButtonClass,
} from "../layout/ui-classes.js";

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
    <section className={`${cardClass} p-6 shadow-sm`}>
      <h2 className="text-lg font-semibold text-content">{t("onboarding.addFirstClient")}</h2>
      <p className={`mt-1 ${metaTextClass}`}>{t("onboarding.addFirstClientHint")}</p>

      {error ? (
        <p className={`mt-4 ${errorBannerClass}`}>
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
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

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className={primaryButtonClass}
          >
            {saving ? t("common.saving") : t("onboarding.continue")}
          </button>
        </div>
      </form>
    </section>
  );
}
