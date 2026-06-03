import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { APP_ROUTES } from "@/routes/router";
import type { PipelineRun } from "@/types/pipelineRun";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";
import { submitPipelineRun } from "@/utils/submitPipeline";

interface RerunVariables {
  componentSpec: ComponentSpec;
  canonicalName?: string;
  taskArguments?: Record<string, ArgumentType>;
}

export function useRerunPipelineRun(componentSpec?: ComponentSpec) {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const { backendUrl } = useBackend();
  const runNameOverride = useFlagValue("templatized-pipeline-run-name");
  const { awaitAuthorization, isAuthorized } = useAwaitAuthorization();
  const { getToken } = useAuthLocalStorage();
  const { rootDetails } = useExecutionData();

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
    }: RerunVariables) => {
      const authorizationToken = await getAuthToken();
      return new Promise<PipelineRun>((resolve, reject) => {
        submitPipelineRun(componentSpec, backendUrl, {
          canonicalName,
          taskArguments,
          authorizationToken,
          runNameOverride,
          onSuccess: resolve,
          onError: reject,
        });
      });
    },
    onSuccess: (response) => {
      navigate({ to: `${APP_ROUTES.RUNS}/${response.id}` });
    },
    onError: (error) => {
      const message = `Failed to submit pipeline. ${error instanceof Error ? error.message : String(error)}`;
      notify(message, "error");
    },
  });

  const rerun = () => {
    if (!componentSpec) return;

    const canonicalName = extractCanonicalName(
      buildTaskSpecShape(rootDetails?.task_spec, componentSpec),
    );

    rerunPipeline({
      componentSpec,
      canonicalName,
      taskArguments: rootDetails?.task_spec.arguments as
        | Record<string, ArgumentType>
        | undefined,
    });
  };

  return { rerun, isRerunning };
}
