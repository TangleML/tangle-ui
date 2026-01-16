import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useRegisterTopNavAction } from "@/components/layout/TopNavActionsProvider";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { copyRunToPipeline } from "@/services/pipelineRunService";
import type { ComponentSpec } from "@/utils/componentSpec";
import { getInitialName } from "@/utils/getComponentName";
import { extractTaskArguments } from "@/utils/nodes/taskArguments";

type ClonePipelineProps = {
  componentSpec: ComponentSpec;
  runId?: string | null;
  showIcon?: boolean;
  title?: string;
};

function useClonePipeline({ componentSpec, runId }: ClonePipelineProps) {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const runDetails = useExecutionData();

  return useMutation({
    mutationFn: async () => {
      const taskArguments = extractTaskArguments(
        runDetails?.rootDetails?.task_spec.arguments,
      );
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
}

export const ClonePipelineButton = ({
  componentSpec,
  runId,
}: ClonePipelineProps) => {
  const { mutate: clonePipeline, isPending } = useClonePipeline({
    componentSpec,
    runId,
  });

  return (
    <TooltipButton
      variant="outline"
      onClick={() => clonePipeline()}
      disabled={isPending}
      data-testid="clone-pipeline-run-button"
      tooltip="Clone pipeline"
    >
      <Icon name="CopyPlus" />
    </TooltipButton>
  );
};

export const ClonePipelineButtonTopNav = () => {
  const { componentSpec } = useComponentSpec();
  const { runId } = useExecutionData();
  const { mutate: clonePipeline, isPending } = useClonePipeline({
    componentSpec,
    runId,
  });

  useRegisterTopNavAction(
    <Button
      variant="outline"
      onClick={() => clonePipeline()}
      disabled={isPending}
      data-testid="global-clone-pipeline-run-button"
      aria-label="Clone pipeline"
    >
      {isPending && <Spinner />}
      Clone Pipeline
    </Button>,
  );

  return null;
};
