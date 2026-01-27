import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
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
            <Icon
              name="FlaskConical"
              size="sm"
              className="text-amber-600 dark:text-amber-400"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <BlockStack gap="1">
            <Text as="p" weight="semibold">
              {flag.name}
            </Text>
            <Text as="p" size="xs" className="opacity-90">
              {flag.description}
            </Text>
            <Text as="p" size="xs" className="italic opacity-70">
              Beta feature
            </Text>
          </BlockStack>
        </TooltipContent>
      </Tooltip>
      <div className="p-3">{children}</div>
    </div>
  );
}
