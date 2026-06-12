import { useTour } from "@reactour/tour";
import { useEffect, useRef } from "react";

import { useAnalytics } from "@/providers/AnalyticsProvider";

import { useRecordTourCompletion, useTourCompletions } from "./tourCompletion";
import { useTourMode } from "./TourModeContext";

export function TourTelemetryBridge() {
  const { currentStep } = useTour();
  const tourMode = useTourMode();
  const { track } = useAnalytics();
  const recordCompletion = useRecordTourCompletion();
  const { data: completions } = useTourCompletions();

  const tour = tourMode?.tour;
  const stepCount = tour?.steps.length ?? 0;

  const startedAtRef = useRef<number>(Date.now());
  const furthestRef = useRef(0);
  const seenStepsRef = useRef<Set<number>>(new Set());
  const completedRef = useRef(false);
  const previouslyCompletedRef = useRef(false);

  useEffect(() => {
    if (!completedRef.current && tour) {
      previouslyCompletedRef.current = Boolean(completions?.[tour.id]);
    }
  }, [completions, tour]);

  useEffect(() => {
    if (!tour || stepCount === 0) return;

    if (currentStep > furthestRef.current) {
      furthestRef.current = currentStep;
    }

    if (!seenStepsRef.current.has(currentStep)) {
      seenStepsRef.current.add(currentStep);
      track("learning_hub.tours.step_viewed", {
        tour_id: tour.id,
        step_index: currentStep,
        step_count: stepCount,
        interaction: tour.steps[currentStep]?.interaction,
      });
    }

    if (currentStep >= stepCount - 1 && !completedRef.current) {
      completedRef.current = true;
      const { completionCount, previouslyCompleted } = recordCompletion(
        tour.id,
      );
      previouslyCompletedRef.current = previouslyCompleted;
      track("learning_hub.tours.completed", {
        tour_id: tour.id,
        step_count: stepCount,
        completion_count: completionCount,
        previously_completed: previouslyCompleted,
        duration_ms: Date.now() - startedAtRef.current,
      });
    }
  }, [currentStep, tour, stepCount, track, recordCompletion]);

  useEffect(() => {
    if (!tour) return undefined;
    return () => {
      if (completedRef.current) return;
      const furthest = furthestRef.current;
      track("learning_hub.tours.exited", {
        tour_id: tour.id,
        furthest_step: furthest,
        step_count: stepCount,
        percent_complete:
          stepCount > 0 ? Math.round(((furthest + 1) / stepCount) * 100) : 0,
        duration_ms: Date.now() - startedAtRef.current,
        previously_completed: previouslyCompletedRef.current,
      });
    };
  }, [tour, stepCount, track]);

  return null;
}
