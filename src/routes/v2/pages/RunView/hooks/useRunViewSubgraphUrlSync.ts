import { useNavigate } from "@tanstack/react-router";
import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { getRunPath } from "@/routes/runRoutes";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Projects the selected execution into each new root model, then listens for
 * canvas navigation. Model initialization must not publish a root URL while
 * the selected execution is still nested.
 */
export function useRunViewSubgraphExecutionSync(
  onExecutionId: (executionId: string | undefined) => void,
): void {
  const { navigation } = useSharedStores();
  const { subgraphExecutionId, details, segments, runId, isLoading } =
    useExecutionData();
  const onExecutionIdRef = useRef(onExecutionId);

  useEffect(() => {
    onExecutionIdRef.current = onExecutionId;
  });

  useEffect(() => {
    if (!runId || isLoading) return;
    if (subgraphExecutionId && segments.length === 0) return;

    return reaction(
      () => ({
        root: navigation.rootSpec,
        path: navigation.navigationPath.map((entry) => entry.displayName),
      }),
      ({ root, path: nextPath }, previous) => {
        if (!root || nextPath.length === 0) return;
        const selectedPath = [
          root.name,
          ...segments.map((segment) => segment.taskId),
        ];
        if (root !== previous?.root) {
          if (
            selectedPath.length !== nextPath.length ||
            selectedPath.some((name, index) => name !== nextPath[index])
          ) {
            navigation.navigateToPath(selectedPath);
          }
          return;
        }

        if (nextPath.length === 1) {
          if (subgraphExecutionId) onExecutionIdRef.current(undefined);
          return;
        }

        const depth = nextPath.length - 1;
        const executionId =
          nextPath.length > selectedPath.length
            ? details?.child_task_execution_ids?.[nextPath[depth]]
            : segments[depth - 1]?.executionId;
        if (executionId && executionId !== subgraphExecutionId) {
          onExecutionIdRef.current(executionId);
        }
      },
      { fireImmediately: true },
    );
  }, [navigation, runId, subgraphExecutionId, details, segments, isLoading]);
}

export function useRunViewSubgraphUrlSync(): void {
  const navigate = useNavigate();
  const { runId } = useExecutionData();

  useRunViewSubgraphExecutionSync((executionId) => {
    if (runId) navigate({ to: getRunPath(runId, executionId) });
  });
}
