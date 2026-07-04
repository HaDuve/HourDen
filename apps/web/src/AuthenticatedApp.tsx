import { isSupportedLocale, type SupportedLocale } from "@hourden/domain";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { LocaleProvider } from "./LocaleProvider.js";

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; userLocale: SupportedLocale | null }
  | { status: "unauthenticated" };

export default function AuthenticatedApp() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (cancelled) {
        return;
      }

      if (res.status === 401) {
        window.location.replace("/login");
        setAuth({ status: "unauthenticated" });
        return;
      }

      if (!res.ok) {
        setAuth({ status: "unauthenticated" });
        return;
      }

      const data = (await res.json()) as {
        user?: { locale?: SupportedLocale | null };
      };
      const value = data.user?.locale;

      setAuth({
        status: "authenticated",
        userLocale: isSupportedLocale(value) ? value : null,
      });
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  if (auth.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-600">
        Loading…
      </div>
    );
  }

  if (auth.status !== "authenticated") {
    return null;
  }

  return (
    <LocaleProvider userLocale={auth.userLocale}>
      <Outlet />
    </LocaleProvider>
  );
}
