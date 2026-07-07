import { type ReactNode, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";

export interface TourProgressValue {
  completedSteps: ReadonlySet<number>;
  isStepComplete(step: number): boolean;
  markStepComplete(step: number): void;
  visitedMax: number;
  recordVisited(step: number): void;
  reset(): void;
}

const TourProgressContext = createRequiredContext<TourProgressValue>(
  "TourProgressContext",
);

export function TourProgressProvider({ children }: { children: ReactNode }) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    () => new Set(),
  );
  const [visitedMax, setVisitedMax] = useState(0);

  const isStepComplete = (step: number) => completedSteps.has(step);

  const markStepComplete = (step: number) => {
    setCompletedSteps((prev) => {
      if (prev.has(step)) return prev;
      const next = new Set(prev);
      next.add(step);
      return next;
    });
  };

  const recordVisited = (step: number) => {
    setVisitedMax((prev) => (step > prev ? step : prev));
  };

  const reset = () => {
    setCompletedSteps((prev) => (prev.size === 0 ? prev : new Set()));
    setVisitedMax(0);
  };

  const value: TourProgressValue = {
    completedSteps,
    isStepComplete,
    markStepComplete,
    visitedMax,
    recordVisited,
    reset,
  };

  return (
    <TourProgressContext.Provider value={value}>
      {children}
    </TourProgressContext.Provider>
  );
}

export function useTourProgress(): TourProgressValue {
  return useRequiredContext(TourProgressContext);
}
