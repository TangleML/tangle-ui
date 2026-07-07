import type { OnboardingSteps } from "./onboardingProgress";
import {
  ONBOARDING_STEP_IDS,
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from "./steps";

export function completedStepIds(steps: OnboardingSteps): OnboardingStepId[] {
  return ONBOARDING_STEP_IDS.filter((id) => steps[id]);
}

export function newlyCompletedIds(
  previous: ReadonlySet<OnboardingStepId>,
  current: ReadonlySet<OnboardingStepId>,
): OnboardingStepId[] {
  return [...current].filter((id) => !previous.has(id));
}

export function stepLabel(id: OnboardingStepId): string | undefined {
  return ONBOARDING_STEPS.find((step) => step.id === id)?.label;
}
