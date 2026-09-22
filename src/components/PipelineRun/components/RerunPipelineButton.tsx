import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ComponentPropsWithoutRef, useCallback } from "react";

import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { fetchRunAnnotations } from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";
import { getRunSourcePipelineId } from "@/utils/pipelineRunSource";
import { REMOTE_PIPELINES_ENABLED } from "@/utils/remotePipelines";
import { submitPipelineRun } from "@/utils/submitPipeline";

type RerunPipelineButtonProps = {
  componentSpec: ComponentSpec;
  showLabel?: boolean;
  displayLabel?: string;
  showTooltip?: boolean;
} & Omit<
  ComponentPropsWithoutRef<typeof TooltipButton>,
  "onClick" | "tooltip" | "variant" | "children"
>;

export const RerunPipelineButton = ({
  componentSpec,
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
      const runId = REMOTE_PIPELINES_ENABLED
        ? (executionData?.metadata?.id ?? executionData?.runId)
        : undefined;
      const runAnnotations = runId
        ? await queryClient.fetchQuery({
            queryKey: ["pipeline-run-annotations", backendUrl, runId],
            queryFn: () => fetchRunAnnotations(runId, backendUrl),
            staleTime: TWENTY_FOUR_HOURS_IN_MS,
          })
        : undefined;

      return new Promise<PipelineRun>((resolve, reject) => {
        submitPipelineRun(componentSpec, backendUrl, {
          sourcePipelineId: getRunSourcePipelineId(runAnnotations),
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
