import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TooltipButtonProps extends ButtonProps {
  tooltip: React.ReactNode;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tooltipAlign?: "start" | "center" | "end";
}

const TooltipButton = React.forwardRef<HTMLButtonElement, TooltipButtonProps>(
  (
    {
      tooltip,
      tooltipSide = "top",
      tooltipAlign = "center",
      children,
      ...buttonProps
    },
    ref,
  ) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Button ref={ref} {...buttonProps}>
              {children}
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} align={tooltipAlign}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
);

TooltipButton.displayName = "TooltipButton";

export default TooltipButton;
