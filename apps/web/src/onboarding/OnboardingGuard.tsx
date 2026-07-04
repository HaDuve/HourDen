import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchOnboardingStatus, type OnboardingStatus } from "./onboarding-api.js";

type GuardState =
  | { status: "loading" }
  | { status: "ready"; onboarding: OnboardingStatus };

export default function OnboardingGuard() {
  const location = useLocation();
  const [state, setState] = useState<GuardState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const onboarding = await fetchOnboardingStatus();
        if (!cancelled) {
          setState({ status: "ready", onboarding });
        }
      } catch {
        if (!cancelled) {
          setState({
            status: "ready",
            onboarding: { needsOnboarding: false, completedAt: null },
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    function handleOnboardingChanged() {
      void fetchOnboardingStatus()
        .then((onboarding) => {
          setState({ status: "ready", onboarding });
        })
        .catch(() => {
          setState({
            status: "ready",
            onboarding: { needsOnboarding: false, completedAt: null },
          });
        });
    }

    window.addEventListener("hourden:onboarding-changed", handleOnboardingChanged);
    return () => {
      window.removeEventListener("hourden:onboarding-changed", handleOnboardingChanged);
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-600">
        Loading…
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
