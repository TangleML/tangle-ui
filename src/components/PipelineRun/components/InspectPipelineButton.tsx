import { useNavigate } from "@tanstack/react-router";
import {
  type ComponentPropsWithoutRef,
  type MouseEvent,
  useCallback,
} from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { getDefaultEditorPath } from "@/routes/editorRoutes";
import { hasNewTabModifier } from "@/utils/dom";

type InspectPipelineButtonProps = {
  pipelineName?: string;
  inspectPath?: string;
  showLabel?: boolean;
  displayLabel?: string;
  showTooltip?: boolean;
} & Omit<
  ComponentPropsWithoutRef<typeof TooltipButton>,
  "onClick" | "tooltip" | "variant" | "children"
>;

export const InspectPipelineButton = ({
  pipelineName,
  inspectPath,
  showLabel,
  displayLabel,
  showTooltip = true,
  ...rest
}: InspectPipelineButtonProps) => {
  const navigate = useNavigate();

  const handleInspect = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const clickThroughUrl =
        inspectPath ?? (pipelineName ? getDefaultEditorPath(pipelineName) : "");
      if (!clickThroughUrl) return;

      if (hasNewTabModifier(e)) {
        window.open(clickThroughUrl, "_blank");
        return;
      }

      navigate({ to: clickThroughUrl });
    },
    [inspectPath, navigate, pipelineName],
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
