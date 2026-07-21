import { useNavigate, useParams } from "@tanstack/react-router";
import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { getRunPath } from "@/routes/runRoutes";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Keeps the URL `subgraphExecutionId` in sync with the V2 `navigationStore`
 * path (and vice versa) so the canvas spec and the execution context stay
 * aligned when entering/leaving subgraphs.
 *
 * Without this, subgraph navigation only updates `navigationStore.activeSpec`
 * (what the canvas renders) while `ExecutionDataProvider` stays scoped to the
 * root execution, so task status indicators and artifacts fail to resolve for
 * subgraph tasks. This mirrors V1 (`TaskNodeCard.handleDoubleClick`), which
 * pushes the child execution id onto the URL when entering a subgraph.
 */
export function useRunViewSubgraphUrlSync() {
  const navigate = useNavigate();
  const { navigation } = useSharedStores();
  const executionData = useExecutionData();

  const params = useParams({ strict: false });
  const subgraphExecutionId =
    "subgraphExecutionId" in params &&
    typeof params.subgraphExecutionId === "string"
      ? params.subgraphExecutionId
      : undefined;

  // Refs let the (stable) mobx reaction read the latest values without being
  // recreated on every data change. Updated in a passive effect to avoid
  // writing refs during render (React Compiler compatibility).
  const executionDataRef = useRef(executionData);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    executionDataRef.current = executionData;
    navigateRef.current = navigate;
  });

  // Set while direction B mutates the navigation store so the direction A
  // reaction (which fires synchronously) does not push a redundant/incorrect
  // URL back.
  const isApplyingFromUrl = useRef(false);
  // The subgraph execution id we last pushed onto the URL ourselves, used to
  // distinguish our own URL updates from external ones (back/forward, links,
  // initial deep-link/refresh). Starts undefined so an initial subgraph URL is
  // treated as external and synced into the navigation store.
  const lastPushedExecutionId = useRef<string | undefined>(undefined);

  // Direction A: navigationStore path -> URL subgraphExecutionId.
  useEffect(() => {
    const dispose = reaction(
      () => navigation.navigationPath.map((entry) => entry.displayName),
      (path, prevPath) => {
        if (isApplyingFromUrl.current) return;

        // `clearNavigation()` (spec lifecycle cleanup / unmount / StrictMode
        // remount) empties the path. Ignore it so we never push a stray root
        // URL that would drop a valid subgraph segment.
        if (path.length === 0) return;

        const data = executionDataRef.current;
        const runId = data.runId;
        if (!runId) return;

        let executionId: string | undefined;

        if (path.length > 1) {
          const targetDepth = path.length - 1;
          const isDeepening = path.length > prevPath.length;

          // Deepening happens one level at a time (double-click), so the
          // current execution details are the parent level and hold the child
          // execution id. Shallowing (breadcrumbs) reuses the already-resolved
          // breadcrumb segments for the target level.
          executionId = isDeepening
            ? data.details?.child_task_execution_ids?.[path[path.length - 1]]
            : data.segments[targetDepth - 1]?.executionId;

          if (!executionId) return;
        }

        const target = getRunPath(runId, "v2", executionId);
        if (window.location.pathname === target) return;

        lastPushedExecutionId.current = executionId;
        navigateRef.current({ to: target, search: (previous) => previous });
      },
    );

    return dispose;
  }, [navigation]);

  // Direction B: external URL subgraphExecutionId -> navigationStore path.
  useEffect(() => {
    // Ignore URL changes we initiated ourselves in direction A.
    if (subgraphExecutionId === lastPushedExecutionId.current) return;

    const rootName = navigation.rootSpec?.name;
    if (!rootName) return;

    // The URL points at a subgraph but breadcrumbs have not resolved yet;
    // wait for them before syncing to avoid collapsing to the root level.
    if (subgraphExecutionId && executionData.segments.length === 0) return;

    const targetPath = [
      rootName,
      ...executionData.segments.map((segment) => segment.taskName),
    ];
    const currentPath = navigation.navigationPath.map(
      (entry) => entry.displayName,
    );

    const isSamePath =
      currentPath.length === targetPath.length &&
      currentPath.every((name, index) => name === targetPath[index]);

    if (isSamePath) return;

    isApplyingFromUrl.current = true;
    navigation.navigateToPath(targetPath);
    isApplyingFromUrl.current = false;
  }, [subgraphExecutionId, executionData.segments, navigation]);
}
