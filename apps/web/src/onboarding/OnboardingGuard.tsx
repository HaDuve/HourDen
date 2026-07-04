import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchOnboardingStatus, type OnboardingStatus } from "./onboarding-api.js";

type GuardState =
  | { status: "loading" }
  | { status: "ready"; onboarding: OnboardingStatus }
  | { status: "error" };

export default function OnboardingGuard() {
  const location = useLocation();
  const [state, setState] = useState<GuardState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const onboarding = await fetchOnboardingStatus();
      setState({ status: "ready", onboarding });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, location.pathname]);

  useEffect(() => {
    function handleOnboardingChanged() {
      void load();
    }

    window.addEventListener("hourden:onboarding-changed", handleOnboardingChanged);
    return () => {
      window.removeEventListener("hourden:onboarding-changed", handleOnboardingChanged);
    };
  }, [load]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-600">
        Loading…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center text-sm text-neutral-600">
        <p>Could not load workspace setup status.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-neutral-300 px-4 py-2 hover:bg-neutral-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const onOnboardingPath = location.pathname.startsWith("/onboarding");

  if (state.onboarding.needsOnboarding && !onOnboardingPath) {
    return <Navigate to="/onboarding/client" replace />;
  }

  if (!state.onboarding.needsOnboarding && onOnboardingPath) {
    return <Navigate to="/today" replace />;
  }

  return <Outlet />;
}
