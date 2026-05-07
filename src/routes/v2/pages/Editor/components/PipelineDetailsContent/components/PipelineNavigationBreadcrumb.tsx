import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import type { NavigationEntry } from "@/routes/v2/shared/store/navigationStore";

interface PipelineNavigationBreadcrumbProps {
  canNavigateBack: boolean;
  navigationPath: readonly NavigationEntry[];
  onNavigateToLevel: (index: number) => void;
}

function getBreadcrumbLabel(index: number, entry: NavigationEntry): string {
  if (index === 0) {
    return "Root";
  }
  return entry.displayName;
}

export function PipelineNavigationBreadcrumb({
  canNavigateBack,
  navigationPath,
  onNavigateToLevel,
}: PipelineNavigationBreadcrumbProps) {
  if (!canNavigateBack) {
    return null;
  }

  return (
    <InlineStack gap="1" blockAlign="center" wrap="wrap" className="min-w-0">
      {navigationPath.map((entry, index) => {
        const isLast = index === navigationPath.length - 1;
        const label = getBreadcrumbLabel(index, entry);
        return (
          <Fragment key={`${entry.specId}-${index}`}>
            {index > 0 && (
              <Icon
                name="ChevronRight"
                size="xs"
                className="shrink-0 text-muted-foreground"
              />
            )}
            {!isLast && (
              <Button
                type="button"
                variant="link"
                size="inline-xs"
                className="h-auto min-w-0 shrink truncate px-0 py-0"
                onClick={() => onNavigateToLevel(index)}
              >
                {label}
              </Button>
            )}
          </Fragment>
        );
      })}
    </InlineStack>
  );
}
