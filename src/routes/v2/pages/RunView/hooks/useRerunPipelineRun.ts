import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import { useMissingSecrets } from "@/components/shared/SecretsManagement/useMissingSecrets";
import { useRerunProjectIds } from "@/hooks/useRerunProjectIds";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { useRunSubmissionAnnotations } from "@/providers/RunSubmissionScopeProvider";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { actingTeamId, fallsBackToYou } from "@/services/teams/teamResolution";
import type { TeamResolution } from "@/services/teams/types";
import { useRunTeam } from "@/services/teams/useRunTeam";
import type { PipelineRun } from "@/types/pipelineRun";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";
import { projectRunAnnotations } from "@/utils/projectRunAnnotation";
import { submitPipelineRun } from "@/utils/submitPipeline";

interface RerunVariables {
  componentSpec: ComponentSpec;
  canonicalName?: string;
  taskArguments?: Record<string, ArgumentType>;
  teamId?: string;
}

export interface RerunReview {
  isOpen: boolean;
  team: TeamResolution;
  missingSecrets: string[];
  confirm: () => void;
  dismiss: () => void;
}

export function useRerunPipelineRun(componentSpec?: ComponentSpec) {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const { backendUrl } = useBackend();
  const { awaitAuthorization, isAuthorized } = useAwaitAuthorization();
  const { getToken } = useAuthLocalStorage();
  const executionData = useExecutionDataOptional();
  const runAnnotations = useRunSubmissionAnnotations();
  const rerunProjectIds = useRerunProjectIds();
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const runId = executionData?.metadata?.id;
  const taskSpec = executionData?.rootDetails?.task_spec;
  const taskArguments = taskSpec?.arguments as
    Record<string, ArgumentType> | undefined;

  const runTeam = useRunTeam(runId);
  const { missing: missingSecrets, isChecking: isCheckingSecrets } =
    useMissingSecrets(runTeam, [componentSpec, taskArguments]);

  const getAuthToken = async (): Promise<string | undefined> => {
    if (isAuthorizationRequired() && !isAuthorized) {
      const token = await awaitAuthorization();
      if (token) {
        return token;
      }
    }
    return getToken();
  };

  const { mutate: rerunPipeline, isPending: isRerunning } = useMutation({
    mutationFn: async ({
      componentSpec,
      canonicalName,
      taskArguments,
      teamId,
    }: RerunVariables) => {
      const authorizationToken = await getAuthToken();
      const projectIds = await rerunProjectIds(runId);
      return new Promise<PipelineRun>((resolve, reject) => {
        submitPipelineRun(componentSpec, backendUrl, {
          canonicalName,
          taskArguments,
          authorizationToken,
          teamId,
          runAnnotations: {
            ...runAnnotations,
            ...projectRunAnnotations(projectIds),
          },
          onSuccess: resolve,
          onError: reject,
        });
      });
    },
    onSuccess: (response) => {
      navigate({ to: getDefaultRunPath(response.id) });
    },
    onError: (error) => {
      const message = `Failed to submit pipeline. ${error instanceof Error ? error.message : String(error)}`;
      notify(message, "error");
    },
  });

  const submitRerun = () => {
    if (!componentSpec) return;

    rerunPipeline({
      componentSpec,
      canonicalName: extractCanonicalName(
        buildTaskSpecShape(taskSpec, componentSpec),
      ),
      taskArguments,
      teamId: actingTeamId(runTeam),
    });
  };

  const rerun = () => {
    if (fallsBackToYou(runTeam) || missingSecrets.length > 0) {
      setIsReviewOpen(true);
      return;
    }
    submitRerun();
  };

  const canRerun =
    runTeam.status !== "resolving" &&
    runTeam.status !== "conflict" &&
    !isCheckingSecrets;

  const review: RerunReview = {
    isOpen: isReviewOpen,
    team: runTeam,
    missingSecrets,
    confirm: () => {
      setIsReviewOpen(false);
      submitRerun();
    },
    dismiss: () => setIsReviewOpen(false),
  };

  return { rerun, isRerunning, canRerun, review };
}
