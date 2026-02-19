import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { copyRunToPipeline } from "@/services/pipelineRunService";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import {
  type ArgumentType,
  type ComponentSpec,
  isSecretArgument,
} from "@/utils/componentSpec";
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
      const canonicalName = extractCanonicalName(
        buildTaskSpecShape(runDetails?.rootDetails?.task_spec, componentSpec),
      );

      const name = getInitialName(componentSpec, canonicalName);
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
    /**
     * We cannnot convert SecretArguments into strings compatible with inputs,
     * so we need to override them with undefined.
     */
    const secretArgumentsOverrides = Object.fromEntries(
      Object.entries(runDetails?.rootDetails?.task_spec.arguments ?? {})
        .filter(([_, value]) => isSecretArgument(value as ArgumentType))
        .map(([key, _]) => [key, undefined] as const),
    );

    const plainTaskArguments = extractTaskArguments(
      runDetails?.rootDetails?.task_spec.arguments ?? {},
    );

    const taskArguments = {
      ...plainTaskArguments,
      ...secretArgumentsOverrides,
    };

    clonePipeline({ taskArguments: taskArguments as Record<string, string> });
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
