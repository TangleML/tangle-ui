import { useNavigate } from "@tanstack/react-router";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";

type InspectPipelineButtonProps = {
  pipelineName: string;
};

export const InspectPipelineButton = ({
  pipelineName,
}: InspectPipelineButtonProps) => {
  const navigate = useNavigate();

  const handleInspect = () => {
    navigate({ to: `/editor/${encodeURIComponent(pipelineName)}` });
  };

  return (
    <TooltipButton
      variant="outline"
      onClick={handleInspect}
      tooltip="Inspect pipeline"
      data-testid="inspect-pipeline-button"
    >
      <Icon name="Network" className="rotate-270" />
    </TooltipButton>
  );
};
