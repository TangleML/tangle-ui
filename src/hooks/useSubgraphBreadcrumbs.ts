import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { useBackend } from "@/providers/BackendProvider";
import { fetchExecutionDetails } from "@/services/executionService";
import { isGraphImplementationOutput } from "@/utils/componentSpec";
import { BACKEND_QUERY_KEY, ONE_MINUTE_IN_MS } from "@/utils/constants";

export interface BreadcrumbSegment {
  taskId: string;
  executionId: string;
  taskName: string;
}

interface SubgraphBreadcrumbsResult {
  segments: BreadcrumbSegment[];
  path: string[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Traverses backwards from a subgraph execution ID to build the breadcrumb path
 * by fetching parent execution details recursively until reaching the root.
 */
export const useSubgraphBreadcrumbs = (
  rootExecutionId: string | undefined,
  subgraphExecutionId: string | undefined,
): SubgraphBreadcrumbsResult => {
  const { backendUrl, configured } = useBackend();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: [
      BACKEND_QUERY_KEY,
      "subgraph-breadcrumbs",
      rootExecutionId,
      subgraphExecutionId,
    ],
    queryFn: async () => {
      if (!rootExecutionId || !subgraphExecutionId) {
        return { segments: [] };
      }

      if (subgraphExecutionId === rootExecutionId) {
        return { segments: [] };
      }

      const segmentsInReverseOrder: BreadcrumbSegment[] = [];
      let currentExecutionId = subgraphExecutionId;
      let currentDetails = await queryClient.ensureQueryData({
        queryKey: [BACKEND_QUERY_KEY, "execution-details", currentExecutionId],
        queryFn: () => fetchExecutionDetails(currentExecutionId, backendUrl),
        staleTime: ONE_MINUTE_IN_MS,
      });

      while (currentExecutionId && currentExecutionId !== rootExecutionId) {
        const parentExecutionId = currentDetails.parent_execution_id;

        if (!parentExecutionId) {
          break;
        }

        const parentDetails = await queryClient.ensureQueryData({
          queryKey: [BACKEND_QUERY_KEY, "execution-details", parentExecutionId],
          queryFn: () => fetchExecutionDetails(parentExecutionId, backendUrl),
          staleTime: ONE_MINUTE_IN_MS,
        });

        const taskIdInParent = Object.entries(
          parentDetails.child_task_execution_ids || {},
        ).find(([_, execId]) => execId === currentExecutionId)?.[0];

        if (taskIdInParent) {
          const implementation =
            parentDetails.task_spec?.componentRef?.spec?.implementation;
          let taskName = taskIdInParent;

          if (isGraphImplementationOutput(implementation)) {
            taskName =
              implementation.graph.tasks?.[taskIdInParent]?.componentRef
                ?.name || taskIdInParent;
          }

          segmentsInReverseOrder.push({
            taskId: taskIdInParent,
            executionId: currentExecutionId,
            taskName,
          });
        }

        currentExecutionId = parentExecutionId;
        currentDetails = parentDetails;
      }

      const segments = segmentsInReverseOrder.reverse();

      return { segments };
    },
    enabled:
      !!rootExecutionId &&
      !!subgraphExecutionId &&
      rootExecutionId !== subgraphExecutionId &&
      configured,
    staleTime: ONE_MINUTE_IN_MS,
    retry: 1,
  });

  const segments = data?.segments || [];
  const path = useMemo(() => {
    return ["root", ...segments.map((seg) => seg.taskId)];
  }, [segments]);

  return {
    segments,
    path,
    isLoading,
    error: error as Error | null,
  };
};

export const buildExecutionUrl = (
  rootExecutionId: string,
  subgraphExecutionId?: string,
): string => {
  return !subgraphExecutionId || subgraphExecutionId === rootExecutionId
    ? `/runs/${rootExecutionId}`
    : `/runs/${rootExecutionId}/${subgraphExecutionId}`;
};
