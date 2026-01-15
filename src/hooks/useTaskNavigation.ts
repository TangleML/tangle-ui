import { useLocation, useNavigate } from "@tanstack/react-router";
import equal from "fast-deep-equal";
import { useCallback } from "react";

import { buildExecutionUrl } from "@/hooks/useSubgraphBreadcrumbs";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import type { TaskStatusInfo } from "@/utils/collectTaskStatuses";
import { taskIdToNodeId } from "@/utils/nodes/nodeIdUtils";

interface UseTaskNavigationOptions {
  rootExecutionId?: string;
}

/**
 * Hook for navigating to a task from the status list.
 * Updates the URL with `?focus=nodeId` to trigger node highlighting.
 */
export const useTaskNavigation = ({
  rootExecutionId,
}: UseTaskNavigationOptions = {}) => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { currentSubgraphPath, navigateToPath } = useComponentSpec();

  const navigateToTask = useCallback(
    (task: TaskStatusInfo) => {
      const nodeId = taskIdToNodeId(task.taskId);
      if (!nodeId) return;

      if (!equal(task.subgraphPath, currentSubgraphPath)) {
        navigateToPath(task.subgraphPath);

        if (rootExecutionId && task.parentExecutionId) {
          const url = buildExecutionUrl(
            rootExecutionId,
            task.parentExecutionId,
          );
          navigate({ to: url, search: { focus: nodeId } });
        }
        return;
      }

      navigate({
        to: pathname,
        search: { ...search, focus: nodeId },
        replace: true,
      });
    },
    [
      currentSubgraphPath,
      navigate,
      navigateToPath,
      pathname,
      rootExecutionId,
      search,
    ],
  );

  return { navigateToTask };
};
