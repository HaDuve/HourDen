import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router-dom";
import { completeOnboarding } from "./onboarding-api.js";

const steps = [
  { path: "/onboarding/client", labelKey: "onboarding.stepClient" },
  { path: "/onboarding/project", labelKey: "onboarding.stepProject" },
  { path: "/onboarding/invoice-sender", labelKey: "onboarding.stepInvoiceSender" },
] as const;

export default function OnboardingLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const [dismissing, setDismissing] = useState(false);
  const currentStepIndex = steps.findIndex((step) =>
    location.pathname.startsWith(step.path),
  );

  async function dismissToTracker() {
    setDismissing(true);
    try {
      await completeOnboarding();
    } catch {
      setDismissing(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            {t("onboarding.workspaceSetup")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("onboarding.getStarted")}</h1>
          <p className="mt-1 text-neutral-600">{t("onboarding.intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void dismissToTracker()}
            disabled={dismissing}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
          >
            {t("onboarding.goToTracker")}
          </button>
          <button
            type="button"
            onClick={() => void dismissToTracker()}
            disabled={dismissing}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            {t("onboarding.skip")}
          </button>
        </div>
      </header>

      <ol className="flex flex-wrap gap-2 text-sm">
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isComplete = currentStepIndex > index;
          return (
            <li
              key={step.path}
              className={`rounded-full px-3 py-1 ${
                isActive
                  ? "bg-slate-900 text-white"
                  : isComplete
                    ? "bg-neutral-200 text-neutral-700"
                    : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {index + 1}. {t(step.labelKey)}
            </li>
          );
        })}
      </ol>

      <Outlet />
    </div>
  );
}
