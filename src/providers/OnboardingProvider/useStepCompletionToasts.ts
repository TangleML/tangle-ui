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
  isOnboardingAvailable: boolean;
  desiredSteps: OnboardingSteps;
  isComplete: boolean;
}

/**
 * Fires a toast the first time each step flips to complete (and a single
 * "all set up" toast once everything is done). The first available render
 * only seeds the baseline, so already-complete steps don't toast on mount.
 *
 * Gating on `isOnboardingAvailable` (not `isResolved`) matters: the backing
 * queries are disabled until the backend is present, and a disabled query
 * reports `isLoading: false`. Seeding earlier would capture an all-false
 * baseline and then toast every already-complete step once the queries settle.
 */
export function useStepCompletionToasts({
  isOnboardingAvailable,
  desiredSteps,
  isComplete,
}: UseStepCompletionToastsArgs) {
  const notify = useToastNotification();
  const previousRef = useRef<Set<OnboardingStepId> | null>(null);
  const toastedRef = useRef<Set<OnboardingStepId>>(new Set());

  useEffect(() => {
    if (!isOnboardingAvailable) {
      // Not settled yet (or the backend went away) — drop the baseline so the
      // next available render re-seeds from the true completed set.
      previousRef.current = null;
      return;
    }
    const current = new Set(completedStepIds(desiredSteps));
    const previous = previousRef.current;
    previousRef.current = current;
    if (previous === null) {
      for (const id of current) toastedRef.current.add(id);
      return;
    }

    const newly = newlyCompletedIds(previous, current).filter(
      (id) => !toastedRef.current.has(id),
    );
    if (newly.length === 0) return;
    for (const id of newly) toastedRef.current.add(id);

    if (isComplete) {
      notify("You're all set up - onboarding complete!", "success");
      return;
    }
    for (const id of newly) {
      const label = stepLabel(id);
      if (label) notify(`Completed: ${label}`, "success");
    }
  }, [isOnboardingAvailable, desiredSteps, isComplete, notify]);
}
