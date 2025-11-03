import { type ReactNode, useEffect, useRef, useState } from "react";

import { GitHubAuthFlowBackdrop } from "@/components/shared/GitHubAuth/GitHubAuthFlowBackdrop";
import { isAuthorizationRequired } from "@/components/shared/GitHubAuth/helpers";
import { useAuthLocalStorage } from "@/components/shared/GitHubAuth/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/GitHubAuth/useAwaitAuthorization";
import {
  countTaskStatuses,
  fetchExecutionDetails,
  fetchExecutionState,
  getRunStatus,
} from "@/services/executionService";
import { fetchPipelineRuns } from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";
import { type ComponentSpec } from "@/utils/componentSpec";
import { submitPipelineRun } from "@/utils/submitPipeline";

import {
  createRequiredContext,
  useRequiredContext,
} from "../hooks/useRequiredContext";
import { useBackend } from "./BackendProvider";

type PipelineRunsContextType = {
  runs: PipelineRun[];
  recentRuns: PipelineRun[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  submit: (
    componentSpec: ComponentSpec,
    options: {
      onSuccess: (data: PipelineRun) => void;
      onError: (error: Error | string) => void;
    },
  ) => Promise<void>;
  setRecentRunsCount: (count: number) => void;
};

const PipelineRunsContext = createRequiredContext<PipelineRunsContextType>(
  "PipelineRunsProvider",
);

const DEFAULT_RECENT_RUNS = 4;

export const PipelineRunsProvider = ({
  pipelineName,
  children,
}: {
  pipelineName: string;
  children: ReactNode;
}) => {
  const {
    awaitAuthorization,
    isAuthorized,
    isPopupOpen,
    closePopup,
    bringPopupToFront,
  } = useAwaitAuthorization();
  const { getToken } = useAuthLocalStorage();

  const { backendUrl, configured, available } = useBackend();

  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [recentRuns, setRecentRuns] = useState<PipelineRun[]>([]);
  const [recentRunsCount, setRecentRunsCount] = useState(DEFAULT_RECENT_RUNS);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authorizationToken = useRef<string | undefined>(getToken());

  const refetch = async () => {
    if (!configured || !available) {
      setRuns([]);
      setRecentRuns([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchPipelineRuns(pipelineName);

      if (!res || !res.runs) {
        setRuns([]);
        setRecentRuns([]);
        setIsLoading(false);
        return;
      }

      const recent = res.runs.slice(0, recentRunsCount).map(async (run) => {
        try {
          const state = await fetchExecutionState(
            run.root_execution_id.toString(),
            backendUrl,
          );

          const details = await fetchExecutionDetails(
            run.root_execution_id.toString(),
            backendUrl,
          );

          if (details && state) {
            run.statusCounts = countTaskStatuses(details, state);
            run.status = getRunStatus(run.statusCounts);
          }

          return run;
        } catch (e) {
          console.error(`Error fetching details for Run ${run.id}:`, e);
          return run;
        }
      });

      setRecentRuns((await Promise.all(recent)) as PipelineRun[]);

      setRuns(res.runs);
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
      setError((e as Error).message);
    }
  };

  const submit = async (
    componentSpec: ComponentSpec,
    options?: {
      onSuccess?: (data: PipelineRun) => void;
      onError?: (error: Error | string) => void;
    },
  ) => {
    setIsSubmitting(true);
    setError(null);

    const authorizationRequired = isAuthorizationRequired();
    if (authorizationRequired && !isAuthorized) {
      const token = await awaitAuthorization();
      if (token) {
        authorizationToken.current = token;
      }
    }

    await submitPipelineRun(componentSpec, backendUrl, {
      authorizationToken: authorizationToken.current,
      onSuccess: async (data) => {
        await refetch();
        setIsSubmitting(false);
        options?.onSuccess?.(data);
      },
      onError: (error) => {
        setIsSubmitting(false);
        options?.onError?.(error);
        setError(error.message);
      },
    });
  };

  useEffect(() => {
    if (pipelineName) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineName]);

  const value = {
    runs,
    recentRuns,
    isLoading,
    isSubmitting,
    error,
    refetch,
    submit,
    setRecentRunsCount,
  };

  return (
    <PipelineRunsContext.Provider value={value}>
      {children}
      <GitHubAuthFlowBackdrop
        isOpen={isPopupOpen}
        onClose={closePopup}
        onClick={bringPopupToFront}
      />
    </PipelineRunsContext.Provider>
  );
};

export const usePipelineRuns = () => {
  return useRequiredContext(PipelineRunsContext);
};
