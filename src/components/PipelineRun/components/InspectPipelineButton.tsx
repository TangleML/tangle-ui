import { useNavigate } from "@tanstack/react-router";
import {
  type ComponentPropsWithoutRef,
  type MouseEvent,
  useCallback,
} from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import {
  getDefaultEditorHref,
  getDefaultEditorTarget,
} from "@/routes/editorRoutes";

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
      if (e.ctrlKey || e.metaKey) {
        window.open(getDefaultEditorHref({ name: pipelineName }), "_blank");
        return;
      }

      navigate(getDefaultEditorTarget({ name: pipelineName }));
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
      <Icon name="Binoculars" />
      {displayLabel ?? (showLabel ? "Inspect" : null)}
    </TooltipButton>
  );
};
