import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CopyPlus } from "lucide-react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import useToastNotification from "@/hooks/useToastNotification";
import { copyRunToPipeline } from "@/services/pipelineRunService";
import type { ComponentSpec } from "@/utils/componentSpec";
import { getInitialName } from "@/utils/getComponentName";

type ClonePipelineButtonProps = {
  componentSpec: ComponentSpec;
};

export const ClonePipelineButton = ({
  componentSpec,
}: ClonePipelineButtonProps) => {
  const navigate = useNavigate();
  const notify = useToastNotification();

  const { isPending, mutate: clonePipeline } = useMutation({
    mutationFn: async () => {
      const name = getInitialName(componentSpec);
      return copyRunToPipeline(componentSpec, name);
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

  const handleClone = () => {
    clonePipeline();
  };

  return (
    <TooltipButton
      variant="outline"
      onClick={handleClone}
      tooltip="Clone pipeline"
      disabled={isPending}
      data-testid="clone-pipeline-run-button"
    >
      <CopyPlus className="w-4 h-4" />
    </TooltipButton>
  );
};
