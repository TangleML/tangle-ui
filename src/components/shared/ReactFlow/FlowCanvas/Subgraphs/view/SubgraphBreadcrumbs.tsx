import { useNavigate } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { Fragment, useCallback } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { InlineStack } from "@/components/ui/layout";
import { buildExecutionUrl } from "@/hooks/useSubgraphBreadcrumbs";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";

export const SubgraphBreadcrumbs = () => {
  const navigate = useNavigate();
  const { currentSubgraphPath, navigateToPath } = useComponentSpec();
  const executionData = useExecutionDataOptional();
  const runId = executionData?.runId;
  const segments = executionData?.segments || [];

  const getExecutionIdForIndex = useCallback(
    (targetIndex: number): string | undefined => {
      if (!runId) return undefined;

      if (targetIndex === 0) {
        return runId;
      }

      const segmentIndex = targetIndex - 1;
      if (segmentIndex >= 0 && segmentIndex < segments.length) {
        return segments[segmentIndex].executionId;
      }

      return undefined;
    },
    [runId, segments],
  );

  const handleBreadcrumbClick = useCallback(
    (targetIndex: number) => {
      const targetPath = currentSubgraphPath.slice(0, targetIndex + 1);

      navigateToPath(targetPath);

      if (runId && executionData) {
        const targetExecutionId = getExecutionIdForIndex(targetIndex);
        const url = buildExecutionUrl(runId, targetExecutionId);
        navigate({ to: url });
      }
    },
    [
      currentSubgraphPath,
      navigateToPath,
      runId,
      executionData,
      getExecutionIdForIndex,
      navigate,
    ],
  );

  if (currentSubgraphPath.length <= 1) {
    return null;
  }

  return (
    <InlineStack
      align="space-between"
      gap="0"
      className="px-4 py-2 bg-gray-50 border-b w-full z-1"
    >
      <Breadcrumb>
        <BreadcrumbList>
          {currentSubgraphPath.map((pathSegment, index) => {
            const isLast = index === currentSubgraphPath.length - 1;
            const isRoot = index === 0;

            return (
              <Fragment key={`${pathSegment}-${index}`}>
                <BreadcrumbItem>
                  {!isLast ? (
                    <BreadcrumbLink asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBreadcrumbClick(index)}
                        className="h-6 px-2"
                      >
                        {isRoot ? (
                          <InlineStack align="start" gap="1">
                            <Home className="w-3 h-3" />
                            Root
                          </InlineStack>
                        ) : (
                          pathSegment
                        )}
                      </Button>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>
                      {isRoot ? (
                        <InlineStack align="start" gap="1">
                          <Home className="w-3 h-3" />
                          Root
                        </InlineStack>
                      ) : (
                        pathSegment
                      )}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="text-xs text-gray-500">
        {currentSubgraphPath.length - 1} level
        {currentSubgraphPath.length - 1 !== 1 ? "s" : ""} deep
      </div>
    </InlineStack>
  );
};
