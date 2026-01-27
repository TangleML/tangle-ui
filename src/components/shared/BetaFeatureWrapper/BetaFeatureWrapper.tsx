import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Paragraph } from "@/components/ui/typography";
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
        "relative rounded-lg border-2 border-amber-400/50 bg-amber-50/30",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute -right-2 -top-2 flex size-6 cursor-help items-center justify-center rounded-full border border-amber-400 bg-amber-100">
            <Icon name="FlaskConical" size="sm" className="text-amber-600" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <BlockStack gap="1">
            <Paragraph weight="semibold" className="text-white">
              {flag.name}
            </Paragraph>
            <Paragraph size="xs" className="text-white opacity-90">
              {flag.description}
            </Paragraph>
            <Paragraph size="xs" className="italic text-white opacity-70">
              Beta feature
            </Paragraph>
          </BlockStack>
        </TooltipContent>
      </Tooltip>
      <div className="p-3">{children}</div>
    </div>
  );
}
