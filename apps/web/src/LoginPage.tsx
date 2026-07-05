import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  cardClass,
  errorBannerClass,
  fieldLabelClass,
  inputClass,
  pageTitleClass,
  primaryButtonClass,
} from "./layout/ui-classes.js";

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(t("login.failed"));
        return;
      }

      window.location.href = "/";
    } catch {
      setError(t("login.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className={`w-full max-w-sm p-8 shadow-sm ${cardClass}`}>
        <h1 className={`mb-6 text-center ${pageTitleClass}`}>HourDen</h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className={`mb-1 block ${fieldLabelClass}`}>
              {t("login.email")}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full ${inputClass}`}
            />
          </div>
          <div>
            <label htmlFor="password" className={`mb-1 block ${fieldLabelClass}`}>
              {t("login.password")}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full ${inputClass}`}
            />
          </div>
          {error ? (
            <p className={errorBannerClass} role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full ${primaryButtonClass} disabled:opacity-60`}
          >
            {submitting ? t("login.signingIn") : t("login.signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}
