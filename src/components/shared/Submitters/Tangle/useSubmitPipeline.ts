import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { useBackend } from "@/providers/BackendProvider";
import { ONBOARDING_MY_RUN_COUNT_KEY } from "@/providers/OnboardingProvider/onboardingQueryKeys";
import { useRunSubmissionAnnotations } from "@/providers/RunSubmissionScopeProvider";
import { ProjectRunsQueryKeys } from "@/services/projects/types";
import type { PipelineRun } from "@/types/pipelineRun";
import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";
import {
  projectIdsFromAnnotations,
  projectRunAnnotations,
} from "@/utils/projectRunAnnotation";
import { submitPipelineRun } from "@/utils/submitPipeline";

import { isAuthorizationRequired } from "../../Authentication/helpers";
import { useAuthLocalStorage } from "../../Authentication/useAuthLocalStorage";

interface SubmitPipelineVariables {
  componentSpec: ComponentSpec;
  taskArguments?: Record<string, ArgumentType>;
  projectIds?: readonly string[];
  onSuccess: (data: PipelineRun) => void;
  onError: (error: Error | string) => void;
}

export function useSubmitPipeline() {
  const { awaitAuthorization, isAuthorized } = useAwaitAuthorization();
  const queryClient = useQueryClient();
  const { getToken } = useAuthLocalStorage();

  const { backendUrl } = useBackend();
  const scopeAnnotations = useRunSubmissionAnnotations();

  const authorizationToken = useRef<string | undefined>(getToken());

  const annotationsFor = (projectIds?: readonly string[]) => ({
    ...scopeAnnotations,
    ...projectRunAnnotations(projectIds ?? []),
  });

  return useMutation({
    mutationFn: async ({
      componentSpec,
      taskArguments,
      projectIds,
      onSuccess,
      onError,
    }: SubmitPipelineVariables) => {
      const authorizationRequired = isAuthorizationRequired();
      if (authorizationRequired && !isAuthorized) {
        const token = await awaitAuthorization();
        if (token) {
          authorizationToken.current = token;
        }
      }

      return new Promise<PipelineRun>((resolve, reject) => {
        submitPipelineRun(componentSpec, backendUrl, {
          authorizationToken: authorizationToken.current,
          taskArguments,
          runAnnotations: annotationsFor(projectIds),
          onSuccess: (data) => {
            resolve(data);
            onSuccess(data);
          },
          onError: (error) => {
            reject(error);
            onError(error);
          },
        });
      });
    },
    onSuccess: async (_run, { projectIds }) => {
      await queryClient.invalidateQueries({
        queryKey: ["pipelineRuns"],
      });
      // Refresh the onboarding checklist's run-count so a first run flips
      // `execute_run` immediately rather than after the 5-minute stale window.
      await queryClient.invalidateQueries({
        queryKey: ONBOARDING_MY_RUN_COUNT_KEY,
      });
      // A project's run feed is otherwise stale for five minutes, so a run
      // started from the project page would not show up on it.
      for (const projectId of projectIdsFromAnnotations(
        annotationsFor(projectIds),
      )) {
        await queryClient.invalidateQueries({
          queryKey: ProjectRunsQueryKeys.All(projectId),
        });
      }
    },
  });
}
