import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { SubgraphBreadcrumbsView } from "@/components/shared/SubgraphBreadcrumbsView";
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

  return (
    <SubgraphBreadcrumbsView
      path={currentSubgraphPath}
      onNavigate={handleBreadcrumbClick}
    />
  );
};
