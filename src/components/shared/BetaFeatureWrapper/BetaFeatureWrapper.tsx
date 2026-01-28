import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExistingFlags } from "@/flags";
import { cn } from "@/lib/utils";

interface BetaFeatureWrapperProps {
  flagKey: keyof typeof ExistingFlags;
  children: ReactNode;
  className?: string;
}

export function BetaFeatureWrapper({
  flagKey,
  children,
  className,
}: BetaFeatureWrapperProps) {
  const flag = ExistingFlags[flagKey];

  if (!flag) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute -right-2 -top-2 flex size-6 cursor-help items-center justify-center rounded-full border border-amber-400 bg-amber-100 dark:bg-amber-900">
            <FlaskConical className="size-3.5 text-amber-600 dark:text-amber-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{flag.name}</p>
            <p className="text-xs opacity-90">{flag.description}</p>
            <p className="text-xs italic opacity-70">Beta feature</p>
          </div>
        </TooltipContent>
      </Tooltip>
      <div className="p-3">{children}</div>
    </div>
  );
}
