import { icons } from "lucide-react";

import type { IconName } from "@/components/ui/icon";

import rawSteps from "./onboardingSteps.json";

export const ONBOARDING_STEP_IDS = [
  "read_docs",
  "complete_tour",
  "create_pipeline",
  "execute_run",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

interface OnboardingStepCta {
  label: string;
  to: string;
}

export interface OnboardingStepMeta {
  id: OnboardingStepId;
  label: string;
  description: string;
  icon: IconName;
  cta: OnboardingStepCta;
}

function isStepId(value: string): value is OnboardingStepId {
  return ONBOARDING_STEP_IDS.some((id) => id === value);
}

function isIconName(value: string): value is IconName {
  return value in icons;
}

function parseSteps(raw: typeof rawSteps): OnboardingStepMeta[] {
  const byId = new Map<OnboardingStepId, OnboardingStepMeta>();
  for (const step of raw) {
    if (!isStepId(step.id)) {
      throw new Error(
        `Unknown onboarding step id "${step.id}" in onboardingSteps.json. ` +
          `Expected one of: ${ONBOARDING_STEP_IDS.join(", ")}.`,
      );
    }
    if (!isIconName(step.icon)) {
      throw new Error(
        `Unknown icon "${step.icon}" for onboarding step "${step.id}" in ` +
          `onboardingSteps.json. Expected a valid lucide-react icon name.`,
      );
    }
    byId.set(step.id, { ...step, id: step.id, icon: step.icon });
  }

  return ONBOARDING_STEP_IDS.map((id) => {
    const step = byId.get(id);
    if (!step) {
      throw new Error(
        `Missing onboarding step "${id}" in onboardingSteps.json.`,
      );
    }
    return step;
  });
}

export const ONBOARDING_STEPS: OnboardingStepMeta[] = parseSteps(rawSteps);
