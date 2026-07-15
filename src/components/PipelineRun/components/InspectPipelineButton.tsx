import { useNavigate } from "@tanstack/react-router";
import {
  type ComponentPropsWithoutRef,
  type MouseEvent,
  useCallback,
} from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { getDefaultEditorPath } from "@/routes/editorRoutes";

type InspectPipelineButtonProps = {
  pipelineName: string;
  showLabel?: boolean;
  displayLabel?: string;
  showTooltip?: boolean;
} & Omit<
  ComponentPropsWithoutRef<typeof TooltipButton>,
  "onClick" | "tooltip" | "variant" | "children"
>;

export const InspectPipelineButton = ({
  pipelineName,
  showLabel,
  displayLabel,
  showTooltip = true,
  ...rest
}: InspectPipelineButtonProps) => {
  const navigate = useNavigate();

  const handleInspect = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const clickThroughUrl = getDefaultEditorPath(pipelineName);

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
      tooltip={showTooltip ? "Inspect pipeline" : undefined}
      data-testid="inspect-pipeline-button"
      {...rest}
    >
      <Icon name="Network" className="rotate-270" />
      {displayLabel ?? (showLabel ? "Inspect" : null)}
    </TooltipButton>
  );
};
