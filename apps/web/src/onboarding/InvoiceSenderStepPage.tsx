import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { completeOnboarding } from "./onboarding-api.js";

type InvoiceSenderFormData = {
  name: string;
  street: string;
  city: string;
  taxNumber: string;
  email: string;
  phone: string;
  bankName: string;
  iban: string;
  bic: string;
};

const emptyForm: InvoiceSenderFormData = {
  name: "",
  street: "",
  city: "",
  taxNumber: "",
  email: "",
  phone: "",
  bankName: "",
  iban: "",
  bic: "",
};

async function fetchInvoiceSender(): Promise<InvoiceSenderFormData> {
  const res = await fetch("/api/workspace/invoice-sender");
  if (!res.ok) {
    throw new Error(`Failed to load invoice sender (${res.status})`);
  }
  const data = (await res.json()) as {
    invoiceSender: InvoiceSenderFormData;
  };
  return data.invoiceSender;
}

export default function InvoiceSenderStepPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<InvoiceSenderFormData>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const sender = await fetchInvoiceSender();
        if (!cancelled) {
          setForm(sender);
        }
      } catch (err) {
        if (!cancelled) {
          setError(t("onboarding.loadInvoiceSenderFailed"));
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
  }, [t]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/workspace/invoice-sender", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }

      await completeOnboarding();
    } catch (err) {
      setError(t("onboarding.saveInvoiceSenderFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{t("onboarding.invoiceSenderTitle")}</h2>
      <p className="mt-1 text-sm text-neutral-600">{t("onboarding.invoiceSenderHint")}</p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-neutral-600">{t("onboarding.loading")}</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span>{t("invoices.senderName")}</span>
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
            <span>{t("invoices.senderStreet")}</span>
            <input
              value={form.street}
              onChange={(e) =>
                setForm((current) => ({ ...current, street: e.target.value }))
              }
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>{t("invoices.senderCity")}</span>
            <input
              value={form.city}
              onChange={(e) =>
                setForm((current) => ({ ...current, city: e.target.value }))
              }
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>{t("invoices.senderTaxNumber")}</span>
            <input
              value={form.taxNumber}
              onChange={(e) =>
                setForm((current) => ({ ...current, taxNumber: e.target.value }))
              }
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>{t("invoices.senderEmail")}</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((current) => ({ ...current, email: e.target.value }))
              }
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>{t("invoices.senderPhone")}</span>
            <input
              value={form.phone}
              onChange={(e) =>
                setForm((current) => ({ ...current, phone: e.target.value }))
              }
              className="rounded-md border border-neutral-300 px-3 py-2"
            />
          </label>

          <fieldset className="grid gap-3 rounded-md border border-neutral-200 p-3">
            <legend className="px-1 text-sm font-medium">{t("invoices.bankDetails")}</legend>
            <label className="grid gap-1 text-sm">
              <span>{t("invoices.senderBankName")}</span>
              <input
                value={form.bankName}
                onChange={(e) =>
                  setForm((current) => ({ ...current, bankName: e.target.value }))
                }
                className="rounded-md border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t("invoices.senderIban")}</span>
              <input
                value={form.iban}
                onChange={(e) =>
                  setForm((current) => ({ ...current, iban: e.target.value }))
                }
                className="rounded-md border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t("invoices.senderBic")}</span>
              <input
                value={form.bic}
                onChange={(e) =>
                  setForm((current) => ({ ...current, bic: e.target.value }))
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
              {saving ? t("common.saving") : t("onboarding.finish")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
