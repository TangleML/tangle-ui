import { useMutation } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { useCallback } from "react";

import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { useNavigate } from "@/hooks/useNavigate";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { APP_ROUTES } from "@/routes/router";
import type { PipelineRun } from "@/types/pipelineRun";
import type { ComponentSpec } from "@/utils/componentSpec";
import { submitPipelineRun } from "@/utils/submitPipeline";

type RerunPipelineButtonProps = {
  componentSpec: ComponentSpec;
};

export const RerunPipelineButton = ({
  componentSpec,
}: RerunPipelineButtonProps) => {
  const { backendUrl } = useBackend();
  const navigate = useNavigate();
  const notify = useToastNotification();
  const executionData = useExecutionDataOptional();

  const { awaitAuthorization, isAuthorized } = useAwaitAuthorization();
  const { getToken } = useAuthLocalStorage();

  const onSuccess = useCallback((response: PipelineRun) => {
    navigate({ to: `${APP_ROUTES.RUNS}/${response.id}` });
  }, []);

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

      return new Promise<PipelineRun>((resolve, reject) => {
        submitPipelineRun(componentSpec, backendUrl, {
          taskArguments: executionData?.rootDetails?.task_spec.arguments,
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
      tooltip="Rerun pipeline"
      disabled={isPending}
      data-testid="rerun-pipeline-button"
    >
      <RefreshCcw className="w-4 h-4" />
    </TooltipButton>
  );
};
