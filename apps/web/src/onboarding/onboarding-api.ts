export type OnboardingStatus = {
  needsOnboarding: boolean;
  completedAt: string | null;
};

export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const res = await fetch("/api/workspace/onboarding");
  if (!res.ok) {
    throw new Error(`Failed to load onboarding status (${res.status})`);
  }
  return res.json() as Promise<OnboardingStatus>;
}

export async function completeOnboarding(): Promise<OnboardingStatus> {
  const res = await fetch("/api/workspace/onboarding", { method: "PATCH" });
  if (!res.ok) {
    throw new Error(`Failed to complete onboarding (${res.status})`);
  }
  const status = (await res.json()) as OnboardingStatus;
  window.dispatchEvent(new Event("hourden:onboarding-changed"));
  return status;
}
