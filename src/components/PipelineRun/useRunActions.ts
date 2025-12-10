import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import type { Action } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { useCheckComponentSpecFromPath } from "@/hooks/useCheckComponentSpecFromPath";
import useToastNotification from "@/hooks/useToastNotification";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/router";
import {
  cancelPipelineRun,
  copyRunToPipeline,
} from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";
import type { ComponentSpec } from "@/utils/componentSpec";
import {
  countInProgressFromStats,
  isExecutionComplete,
} from "@/utils/executionStatus";
import { getInitialName } from "@/utils/getComponentName";
import { submitPipelineRun } from "@/utils/submitPipeline";

interface UseRunActionsParams {
  componentSpec: ComponentSpec;
  runId: string | null | undefined;
  createdBy: string | null | undefined;
  statusCounts: { [key: string]: number };
}

export const useRunActions = ({
  componentSpec,
  runId,
  createdBy,
  statusCounts,
}: UseRunActionsParams) => {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const { available, backendUrl } = useBackend();
  const { awaitAuthorization, isAuthorized } = useAwaitAuthorization();
  const { getToken } = useAuthLocalStorage();
  const { data: currentUserDetails } = useUserDetails();

  const [isYamlFullscreen, setIsYamlFullscreen] = useState(false);

  const isRunCreator =
    currentUserDetails?.id && createdBy === currentUserDetails.id;

  const editorRoute = componentSpec.name
    ? `/editor/${encodeURIComponent(componentSpec.name)}`
    : "";

  const canAccessEditorSpec = useCheckComponentSpecFromPath(
    editorRoute,
    !componentSpec.name,
  );

  const isInProgress = countInProgressFromStats(statusCounts) > 0;
  const isComplete = isExecutionComplete(statusCounts);

  const { isPending: isPendingClone, mutate: clonePipeline } = useMutation({
    mutationFn: async () => {
      const name = getInitialName(componentSpec);
      return copyRunToPipeline(componentSpec, runId, name);
    },
    onSuccess: (result) => {
      if (result?.url) {
        notify(`Pipeline "${result.name}" cloned`, "success");
        navigate({ to: result.url });
      }
    },
    onError: (error) => {
      notify(`Error cloning pipeline: ${error}`, "error");
    },
  });

  const {
    mutate: cancelPipeline,
    isPending: isPendingCancel,
    isSuccess: isSuccessCancel,
  } = useMutation({
    mutationFn: (runId: string) => cancelPipelineRun(runId, backendUrl),
    onSuccess: () => {
      notify(`Pipeline run ${runId} cancelled`, "success");
    },
    onError: (error) => {
      notify(`Error cancelling run: ${error}`, "error");
    },
  });

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

  const { mutate: rerunPipeline, isPending: isPendingRerun } = useMutation({
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
    onSuccess: (response: PipelineRun) => {
      navigate({ to: `${APP_ROUTES.RUNS}/${response.id}` });
    },
    onError: (error: Error | string) => {
      const message = `Failed to submit pipeline. ${error instanceof Error ? error.message : String(error)}`;
      notify(message, "error");
    },
  });

  const handleViewYaml = () => {
    setIsYamlFullscreen(true);
  };

  const handleCloseYaml = () => {
    setIsYamlFullscreen(false);
  };

  const handleInspect = () => {
    navigate({ to: editorRoute });
  };

  const handleClone = () => {
    clonePipeline();
  };

  const handleCancel = () => {
    if (!runId) {
      notify(`Failed to cancel run. No run ID found.`, "warning");
      return;
    }

    if (!available) {
      notify(`Backend is not available. Cannot cancel run.`, "warning");
      return;
    }

    try {
      cancelPipeline(runId);
    } catch (error) {
      notify(`Error cancelling run: ${error}`, "error");
    }
  };

  const handleRerun = () => {
    rerunPipeline();
  };

  const actions: Action[] = [
    {
      label: "View YAML",
      icon: "FileCodeCorner",
      onClick: handleViewYaml,
    },
    {
      label: "Inspect Pipeline",
      icon: "SquareMousePointer",
      hidden: !canAccessEditorSpec,
      onClick: handleInspect,
    },
    {
      label: "Clone Pipeline",
      icon: "CopyPlus",
      disabled: isPendingClone,
      onClick: handleClone,
    },
    {
      label: "Cancel Run",
      confirmation:
        "The run will be scheduled for cancellation. This action cannot be undone.",
      icon: isSuccessCancel ? "CircleSlash" : "CircleX",
      className: isSuccessCancel ? "bg-primary text-primary-foreground" : "",
      destructive: !isSuccessCancel,
      disabled: isPendingCancel || isSuccessCancel,
      hidden: !isInProgress || !isRunCreator,
      onClick: handleCancel,
    },
    {
      label: "Rerun Pipeline",
      icon: "RefreshCcw",
      disabled: isPendingRerun,
      hidden: !isComplete,
      onClick: handleRerun,
    },
  ];

  return {
    actions,
    isYamlFullscreen,
    handleCloseYaml,
  };
};
