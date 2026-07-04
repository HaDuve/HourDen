import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { completeOnboarding } from "./onboarding-api.js";

const steps = [
  { path: "/onboarding/client", label: "Client" },
  { path: "/onboarding/project", label: "Project" },
  { path: "/onboarding/invoice-sender", label: "Invoice data" },
] as const;

export default function OnboardingLayout() {
  const location = useLocation();
  const [dismissing, setDismissing] = useState(false);
  const currentStepIndex = steps.findIndex((step) =>
    location.pathname.startsWith(step.path),
  );

  async function dismissToToday() {
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
            Workspace setup
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Get started</h1>
          <p className="mt-1 text-neutral-600">
            Add the basics now, or skip and finish later from the main app.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void dismissToToday()}
            disabled={dismissing}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
          >
            Go to Today
          </button>
          <button
            type="button"
            onClick={() => void dismissToToday()}
            disabled={dismissing}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            Skip
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
              {index + 1}. {step.label}
            </li>
          );
        })}
      </ol>

      <Outlet />
    </div>
  );
}
