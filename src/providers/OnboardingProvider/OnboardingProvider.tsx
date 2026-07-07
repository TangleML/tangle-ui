import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";

import { useDocsVisitTracking } from "@/hooks/useDocsVisitTracking";
import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useBackend } from "@/providers/BackendProvider";
import { useTourCompletions } from "@/providers/TourProvider/tourCompletion";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";
import {
  filtersToFilterQuery,
  parseFilterParam,
} from "@/utils/pipelineRunFilterUtils";
import { isRecord } from "@/utils/typeGuards";
import { subscribeUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import {
  type OnboardingSteps,
  useOnboardingProgress,
  usePersistOnboardingProgress,
} from "./onboardingProgress";
import { ONBOARDING_MY_RUN_COUNT_KEY } from "./onboardingQueryKeys";
import {
  ONBOARDING_STEP_IDS,
  ONBOARDING_STEPS,
  type OnboardingStepMeta,
} from "./steps";

const PIPELINE_RUNS_QUERY_URL = "/api/pipeline_runs/";
const STALE_MS = 1000 * 60 * 5;

function countPipelineRuns(payload: unknown): number {
  if (!isRecord(payload) || !Array.isArray(payload.pipeline_runs)) return 0;
  return payload.pipeline_runs.length;
}

export interface OnboardingStep extends OnboardingStepMeta {
  completed: boolean;
}

interface OnboardingContextValue {
  steps: OnboardingStep[];
  completedCount: number;
  total: number;
  isComplete: boolean;
  dismissed: boolean;
  markDocsRead: () => void;
  dismiss: () => void;
  reopen: () => void;
}

const OnboardingContext =
  createRequiredContext<OnboardingContextValue>("OnboardingProvider");

function useHasMyRun(): boolean {
  const { available, backendUrl } = useBackend();
  const filterQuery = filtersToFilterQuery(parseFilterParam("created_by:me"));

  const { data } = useQuery({
    queryKey: [...ONBOARDING_MY_RUN_COUNT_KEY, backendUrl],
    enabled: available && Boolean(backendUrl),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const url = new URL(PIPELINE_RUNS_QUERY_URL, backendUrl);
      if (filterQuery) url.searchParams.set("filter_query", filterQuery);
      const payload = await fetchWithErrorHandling(url.toString());
      return countPipelineRuns(payload);
    },
  });
  return (data ?? 0) > 0;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { track } = useAnalytics();
  const { data: progress } = useOnboardingProgress();
  const persist = usePersistOnboardingProgress();

  const { data: tourCompletions } = useTourCompletions();
  const hasCompletedTour = Boolean(
    tourCompletions && Object.keys(tourCompletions).length > 0,
  );
  const hasMyRun = useHasMyRun();

  const stored = progress?.steps;
  const desiredSteps: OnboardingSteps = {
    read_docs: stored?.read_docs ?? false,
    create_pipeline: stored?.create_pipeline ?? false,
    complete_tour: hasCompletedTour,
    execute_run: hasMyRun,
  };

  const isComplete = ONBOARDING_STEP_IDS.every((id) => desiredSteps[id]);

  const [pipelineWriteCount, setPipelineWriteCount] = useState(0);

  useEffect(
    () =>
      subscribeUserPipelineWritten(() =>
        setPipelineWriteCount((count) => count + 1),
      ),
    [],
  );

  useEffect(() => {
    if (
      pipelineWriteCount === 0 ||
      !progress ||
      progress.steps.create_pipeline
    ) {
      return;
    }
    persist({
      ...progress,
      steps: { ...progress.steps, create_pipeline: true },
    });
    track("onboarding.step.completed", { step_id: "create_pipeline" });
  }, [pipelineWriteCount, progress, persist, track]);

  const markDocsRead = () => {
    if (!progress || progress.steps.read_docs) return;
    persist({ ...progress, steps: { ...progress.steps, read_docs: true } });
    track("onboarding.step.completed", { step_id: "read_docs" });
  };

  useDocsVisitTracking(markDocsRead);

  const dismiss = () => {
    if (!progress || progress.dismissed) return;
    persist({ ...progress, dismissed: true });
    track("onboarding.dismissed");
  };

  const reopen = () => {
    if (!progress || !progress.dismissed) return;
    persist({ ...progress, dismissed: false });
    track("onboarding.reopened");
  };

  const steps: OnboardingStep[] = ONBOARDING_STEPS.map((meta) => ({
    ...meta,
    completed: desiredSteps[meta.id],
  }));

  const value: OnboardingContextValue = {
    steps,
    completedCount: steps.filter((step) => step.completed).length,
    total: steps.length,
    isComplete,
    dismissed: progress?.dismissed ?? false,
    markDocsRead,
    dismiss,
    reopen,
  };

  return <OnboardingContext value={value}>{children}</OnboardingContext>;
}

export function useOnboarding() {
  return useRequiredContext(OnboardingContext);
}
