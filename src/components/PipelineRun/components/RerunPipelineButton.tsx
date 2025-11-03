import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCcw } from "lucide-react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { isAuthorizationRequired } from "@/components/shared/GitHubAuth/helpers";
import { useAuthLocalStorage } from "@/components/shared/GitHubAuth/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/GitHubAuth/useAwaitAuthorization";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
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

  const { awaitAuthorization, isAuthorized } = useAwaitAuthorization();
  const { getToken } = useAuthLocalStorage();

  const onSuccess = (response: PipelineRun) => {
    navigate({ to: `${APP_ROUTES.RUNS}/${response.id}` });
  };

  const onError = (error: Error | string) => {
    const message = `Failed to submit pipeline. ${error instanceof Error ? error.message : String(error)}`;
    notify(message, "error");
  };

  const getAuthToken = async (): Promise<string | undefined> => {
    const authorizationRequired = isAuthorizationRequired();

    if (authorizationRequired && !isAuthorized) {
      const token = await awaitAuthorization();
      if (token) {
        return token;
      }
    }

    return getToken();
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const authorizationToken = await getAuthToken();

      return new Promise<PipelineRun>((resolve, reject) => {
        submitPipelineRun(componentSpec, backendUrl, {
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
