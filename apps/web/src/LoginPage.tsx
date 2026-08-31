import { isSupportedLocale, type SupportedLocale } from "@hourden/domain";
import { useCallback, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { resolveAuthErrorMessage } from "./auth/read-auth-error.js";
import {
  cardClass,
  errorBannerClass,
  fieldLabelClass,
  inputClass,
  metaTextClass,
  pageTitleClass,
  primaryButtonClass,
} from "./layout/ui-classes.js";
import { PublicLanguageSwitcher } from "./login/PublicLanguageSwitcher.js";
import { TurnstileField } from "./login/TurnstileField.js";

type AuthMode = "login" | "signup";

function readCalendarTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function readActiveLocale(language: string): SupportedLocale {
  return isSupportedLocale(language) ? language : "en";
}

function isTranslationKey(message: string): boolean {
  return message.includes(".");
}

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: AuthMode = searchParams.get("mode") === "signup" ? "signup" : "login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const setMode = useCallback(
    (nextMode: AuthMode) => {
      setError(null);
      if (nextMode === "signup") {
        setSearchParams({ mode: "signup" }, { replace: true });
        return;
      }
      setSearchParams({}, { replace: true });
    },
    [setSearchParams],
  );

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  function formatError(messageKeyOrText: string): string {
    return isTranslationKey(messageKeyOrText) ? t(messageKeyOrText) : messageKeyOrText;
  }

  async function handleLoginSubmit(event: FormEvent) {
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
        const messageKey = await resolveAuthErrorMessage("login", res);
        setError(formatError(messageKey));
        return;
      }

      window.location.href = "/";
    } catch {
      setError(t("login.invalidCredentials"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignupSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!turnstileToken) {
      setError(t("signup.verificationFailed"));
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          turnstileToken,
          calendarTimezone: readCalendarTimezone(),
          locale: readActiveLocale(i18n.language),
        }),
      });

      if (!res.ok) {
        const messageKey = await resolveAuthErrorMessage("signup", res);
        setError(formatError(messageKey));
        setTurnstileToken(null);
        return;
      }

      window.location.href = "/";
    } catch {
      setError(t("signup.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className={`relative w-full max-w-sm p-8 shadow-sm ${cardClass}`}>
        <PublicLanguageSwitcher />
        <h1 className={`mb-6 text-center ${pageTitleClass}`}>HourDen</h1>

        <div
          role="tablist"
          aria-label={t("login.modeTabs")}
          className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-divider bg-surface p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "login"
                ? "bg-surface-active text-content"
                : "text-muted hover:text-content"
            }`}
          >
            {t("login.signIn")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => setMode("signup")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "signup"
                ? "bg-surface-active text-content"
                : "text-muted hover:text-content"
            }`}
          >
            {t("signup.createAccount")}
          </button>
        </div>

        {mode === "login" ? (
          <form className="space-y-4" onSubmit={handleLoginSubmit}>
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
        ) : (
          <form className="space-y-4" onSubmit={handleSignupSubmit}>
            <div>
              <label htmlFor="signup-email" className={`mb-1 block ${fieldLabelClass}`}>
                {t("login.email")}
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full ${inputClass}`}
              />
            </div>
            <div>
              <label htmlFor="signup-password" className={`mb-1 block ${fieldLabelClass}`}>
                {t("login.password")}
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full ${inputClass}`}
              />
              <p className={`mt-1 ${metaTextClass}`}>{t("signup.passwordPolicy")}</p>
            </div>
            <TurnstileField onToken={handleTurnstileToken} onExpire={handleTurnstileExpire} />
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
              {submitting ? t("signup.creatingAccount") : t("signup.createAccount")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
