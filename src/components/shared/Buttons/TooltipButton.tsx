import { forwardRef, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TooltipButtonProps extends ButtonProps {
  tooltip: ReactNode;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tooltipAlign?: "start" | "center" | "end";
  wrapperClassName?: string;
}

const TooltipButton = forwardRef<HTMLButtonElement, TooltipButtonProps>(
  (
    {
      tooltip,
      tooltipSide = "top",
      tooltipAlign = "center",
      wrapperClassName,
      children,
      ...buttonProps
    },
    ref,
  ) => {
    const button = (
      <div className={cn("w-fit", wrapperClassName)}>
        <Button ref={ref} {...buttonProps}>
          {children}
        </Button>
      </div>
    );

    if (!tooltip) return button;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side={tooltipSide} align={tooltipAlign}>
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);

TooltipButton.displayName = "TooltipButton";

export default TooltipButton;
