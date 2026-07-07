import { useEffect, useRef } from "react";

import useToastNotification from "@/hooks/useToastNotification";

import {
  completedStepIds,
  newlyCompletedIds,
  stepLabel,
} from "./onboardingCompletion";
import type { OnboardingSteps } from "./onboardingProgress";
import type { OnboardingStepId } from "./steps";

interface UseStepCompletionToastsArgs {
  isResolved: boolean;
  desiredSteps: OnboardingSteps;
  isComplete: boolean;
}

/**
 * Fires a toast the first time each step flips to complete (and a single
 * "all set up" toast once everything is done). The first resolved render
 * only seeds the baseline, so already-complete steps don't toast on mount.
 */
export function useStepCompletionToasts({
  isResolved,
  desiredSteps,
  isComplete,
}: UseStepCompletionToastsArgs) {
  const notify = useToastNotification();
  const previousRef = useRef<Set<OnboardingStepId> | null>(null);

  useEffect(() => {
    if (!isResolved) return;
    const current = new Set(completedStepIds(desiredSteps));
    const previous = previousRef.current;
    previousRef.current = current;
    if (previous === null) return;

    const newly = newlyCompletedIds(previous, current);
    if (newly.length === 0) return;

    if (isComplete) {
      notify("You're all set up - onboarding complete!", "success");
      return;
    }
    for (const id of newly) {
      const label = stepLabel(id);
      if (label) notify(`Completed: ${label}`, "success");
    }
  }, [isResolved, desiredSteps, isComplete, notify]);
}
