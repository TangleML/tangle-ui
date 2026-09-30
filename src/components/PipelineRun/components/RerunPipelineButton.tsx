import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ComponentPropsWithoutRef, useCallback } from "react";

import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import { Icon } from "@/components/ui/icon";
import { useRerunProjectIds } from "@/hooks/useRerunProjectIds";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { useRunSubmissionAnnotations } from "@/providers/RunSubmissionScopeProvider";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { runAnnotationsQueryOptions } from "@/services/runAnnotations";
import type { PipelineRun } from "@/types/pipelineRun";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";
import { getRunSourcePipelineId } from "@/utils/pipelineRunSource";
import { projectRunAnnotations } from "@/utils/projectRunAnnotation";
import { REMOTE_PIPELINES_ENABLED } from "@/utils/remotePipelines";
import { submitPipelineRun } from "@/utils/submitPipeline";

type RerunPipelineButtonProps = {
  componentSpec: ComponentSpec;
  runId?: string | null;
  showLabel?: boolean;
  displayLabel?: string;
  showTooltip?: boolean;
} & Omit<
  ComponentPropsWithoutRef<typeof TooltipButton>,
  "onClick" | "tooltip" | "variant" | "children"
>;

export const RerunPipelineButton = ({
  componentSpec,
  runId,
  showLabel,
  displayLabel,
  showTooltip = true,
  ...rest
}: RerunPipelineButtonProps) => {
  const { backendUrl } = useBackend();
  const navigate = useNavigate();
  const notify = useToastNotification();
  const executionData = useExecutionDataOptional();
  const queryClient = useQueryClient();
  const runAnnotations = useRunSubmissionAnnotations();
  const rerunProjectIds = useRerunProjectIds();

  const { awaitAuthorization, isAuthorized } = useAwaitAuthorization();
  const { getToken } = useAuthLocalStorage();

  const onSuccess = useCallback(
    (response: PipelineRun) => {
      void queryClient.invalidateQueries({ queryKey: ["runs", backendUrl] });
      navigate({ to: getDefaultRunPath(response.id) });
    },
    [backendUrl, navigate, queryClient],
  );

  const onError = useCallback(
    (error: Error | string) => {
      const message = `Failed to submit pipeline. ${error instanceof Error ? error.message : String(error)}`;
      notify(message, "error");
    },
    [notify],
  );

  const getAuthToken = useCallback(async (): Promise<string | undefined> => {
    const authorizationRequired = isAuthorizationRequired();

    if (authorizationRequired && !isAuthorized) {
      const token = await awaitAuthorization();
      if (token) {
        return token;
      }
    }

    return getToken();
  }, [awaitAuthorization, getToken, isAuthorized]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const authorizationToken = await getAuthToken();
      const originalRunId =
        runId ?? executionData?.metadata?.id ?? executionData?.runId;
      const projectIds = await rerunProjectIds(originalRunId);
      const sourceRunAnnotations =
        REMOTE_PIPELINES_ENABLED && originalRunId != null
          ? await queryClient.fetchQuery(
              runAnnotationsQueryOptions(originalRunId, backendUrl),
            )
          : undefined;

      return new Promise<PipelineRun>((resolve, reject) => {
        submitPipelineRun(componentSpec, backendUrl, {
          sourcePipelineId: getRunSourcePipelineId(sourceRunAnnotations),
          canonicalName: extractCanonicalName(
            buildTaskSpecShape(
              executionData?.rootDetails?.task_spec,
              componentSpec,
            ),
          ),
          // Generated API definitions slightly differs from the componentSpec
          taskArguments: executionData?.rootDetails?.task_spec
            .arguments as Record<string, ArgumentType>,
          authorizationToken,
          runAnnotations: {
            ...runAnnotations,
            ...projectRunAnnotations(projectIds),
          },
          onSuccess: resolve,
          onError: reject,
        });
      });
    },
    onSuccess,
    onError,
  });

  return (
    <TooltipButton
      variant="outline"
      onClick={() => mutate()}
      tooltip={showTooltip ? "Rerun pipeline" : undefined}
      disabled={isPending}
      data-testid="rerun-pipeline-button"
      {...rest}
    >
      <Icon name="RefreshCcw" />
      {displayLabel ?? (showLabel ? "Rerun" : null)}
    </TooltipButton>
  );
};
