import { useNavigate } from "@tanstack/react-router";
import { type MouseEvent, useCallback } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";

type InspectPipelineButtonProps = {
  pipelineName: string;
  showLabel?: boolean;
};

export const InspectPipelineButton = ({
  pipelineName,
  showLabel,
}: InspectPipelineButtonProps) => {
  const navigate = useNavigate();

  const handleInspect = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const clickThroughUrl = `/editor/${encodeURIComponent(pipelineName)}`;

      if (e.ctrlKey || e.metaKey) {
        window.open(clickThroughUrl, "_blank");
        return;
      }

      navigate({ to: clickThroughUrl });
    },
    [navigate, pipelineName],
  );

  return (
    <TooltipButton
      variant="outline"
      onClick={handleInspect}
      tooltip="Inspect pipeline"
      data-testid="inspect-pipeline-button"
    >
      <Icon name="Network" className="rotate-270" />
      {showLabel && "Inspect"}
    </TooltipButton>
  );
};
