"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";
import type { PropsWithChildren, ReactNode } from "react";
import * as React from "react";

import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

// CUSTOM PROPS FROM THE TANGLE DEV TEAM
interface TooltipContentProps
  extends React.ComponentProps<typeof TooltipPrimitive.Content> {
  arrowClassName?: string;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  arrowClassName,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          className={cn(
            "bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]",
            arrowClassName,
          )}
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

const quickTooltipVariants = cva(
  "pointer-events-none absolute z-50 w-fit w-min-xs rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs text-balance opacity-0 transition-opacity duration-200 group-hover:opacity-100",
  {
    variants: {
      cursor: {
        default: "cursor-default",
        pointer: "cursor-pointer",
        question: "cursor-help",
      },
      side: {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
        left: "right-full top-1/2 -translate-y-1/2 mr-2",
        right: "left-full top-1/2 -translate-y-1/2 ml-2",
      },
    },
    defaultVariants: {
      cursor: "default",
      side: "top",
    },
  },
);

function QuickTooltip({
  children,
  content,
  side = "top",
  className,
  cursor = "default",
}: PropsWithChildren<
  VariantProps<typeof quickTooltipVariants> & {
    content: ReactNode;
    className?: string;
  }
>) {
  return (
    <div className="group relative inline-block p-0">
      {children}
      <div className={cn(quickTooltipVariants({ side, cursor }), className)}>
        {content}
      </div>
    </div>
  );
}

export {
  QuickTooltip,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
};
