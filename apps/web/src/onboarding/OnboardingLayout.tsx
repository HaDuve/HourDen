import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router-dom";
import {
  fieldLabelMutedClass,
  pageSubtitleClass,
  pageTitleLargeClass,
  secondaryButtonClass,
} from "../layout/ui-classes.js";
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
          <p className={`uppercase tracking-wide ${fieldLabelMutedClass}`}>
            {t("onboarding.workspaceSetup")}
          </p>
          <h1 className={pageTitleLargeClass}>{t("onboarding.getStarted")}</h1>
          <p className={`mt-1 ${pageSubtitleClass}`}>{t("onboarding.intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void dismissToTracker()}
            disabled={dismissing}
            className={secondaryButtonClass}
          >
            {t("onboarding.goToTracker")}
          </button>
          <button
            type="button"
            onClick={() => void dismissToTracker()}
            disabled={dismissing}
            className={secondaryButtonClass}
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
                  ? "bg-primary text-primary-content"
                  : isComplete
                    ? "bg-surface-active text-content"
                    : "bg-surface text-muted"
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
