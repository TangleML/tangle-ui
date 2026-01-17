import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { copyRunToPipeline } from "@/services/pipelineRunService";
import type { ComponentSpec } from "@/utils/componentSpec";
import { getInitialName } from "@/utils/getComponentName";
import { extractTaskArguments } from "@/utils/nodes/taskArguments";

type ClonePipelineButtonProps = {
  componentSpec: ComponentSpec;
  runId?: string | null;
  showLabel?: boolean;
};

export const ClonePipelineButton = ({
  componentSpec,
  runId,
  showLabel,
}: ClonePipelineButtonProps) => {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const runDetails = useExecutionDataOptional();

  const { isPending, mutate: clonePipeline } = useMutation({
    mutationFn: async ({
      taskArguments,
    }: {
      taskArguments?: Record<string, string>;
    }) => {
      const name = getInitialName(componentSpec);

      return copyRunToPipeline(componentSpec, runId, name, taskArguments);
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

  const handleClone = useCallback(() => {
    const taskArguments = extractTaskArguments(
      runDetails?.rootDetails?.task_spec.arguments,
    );

    clonePipeline({ taskArguments });
  }, [clonePipeline, runDetails]);

  return (
    <TooltipButton
      variant="outline"
      onClick={handleClone}
      tooltip="Clone pipeline"
      disabled={isPending}
      data-testid="clone-pipeline-run-button"
    >
      <Icon name="CopyPlus" />
      {showLabel && "Clone"}
    </TooltipButton>
  );
};
