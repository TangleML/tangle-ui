import { useNavigate, useParams } from "@tanstack/react-router";
import { reaction } from "mobx";
import { type RefObject, useEffect, useRef } from "react";

import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { getRunPath } from "@/routes/runRoutes";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * The slice of execution data the navigation → execution-id resolution reads.
 * Kept structural so both the live context and tests can supply it.
 */
interface SubgraphExecutionSource {
  runId: string | null | undefined;
  details:
    { child_task_execution_ids?: Record<string, string> | null } | undefined;
  segments: { executionId: string }[];
}

type ResolvedExecutionId =
  { skip: true } | { skip: false; executionId: string | undefined };

/**
 * Given a navigation-path change, resolves which execution id the run's
 * execution context should scope to:
 * - root level (`path.length <= 1`) resolves to `undefined` (the root run),
 * - deepening one level (double-click) reads the child execution id off the
 *   current level's details,
 * - shallowing (breadcrumbs) reuses the already-resolved breadcrumb segment.
 *
 * Returns `{ skip: true }` when there is nothing to sync (empty path from
 * `clearNavigation()`, no run yet, or an unresolved child id).
 */
function resolveSubgraphExecutionId(
  path: string[],
  prevPath: string[],
  source: SubgraphExecutionSource,
): ResolvedExecutionId {
  // `clearNavigation()` (spec lifecycle cleanup / unmount / StrictMode remount)
  // empties the path. Ignore it so we never drop a valid subgraph segment.
  if (path.length === 0) return { skip: true };
  if (!source.runId) return { skip: true };
  if (path.length <= 1) return { skip: false, executionId: undefined };

  const targetDepth = path.length - 1;
  const isDeepening = path.length > prevPath.length;

  const executionId = isDeepening
    ? source.details?.child_task_execution_ids?.[path[path.length - 1]]
    : source.segments[targetDepth - 1]?.executionId;

  if (!executionId) return { skip: true };
  return { skip: false, executionId };
}

/**
 * Fires `onExecutionId` whenever the V2 navigation path changes with the
 * execution id that the run's execution context should scope to. This is the
 * mode-agnostic half of subgraph sync: the URL variant turns it into a route
 * push, the embedded variant turns it into React state.
 *
 * `isApplyingFromUrl` lets the URL variant suppress the reaction while it is
 * itself driving the navigation store from the URL (avoids a redundant push).
 */
export function useRunViewSubgraphExecutionSync(
  onExecutionId: (executionId: string | undefined) => void,
  options: { isApplyingFromUrl?: RefObject<boolean> } = {},
): void {
  const { navigation } = useSharedStores();
  const executionData = useExecutionData();
  const isApplyingRef = options.isApplyingFromUrl;

  // Refs let the (stable) mobx reaction read the latest values without being
  // recreated on every data change. Updated in a passive effect to avoid
  // writing refs during render (React Compiler compatibility).
  const executionDataRef = useRef(executionData);
  const onExecutionIdRef = useRef(onExecutionId);

  useEffect(() => {
    executionDataRef.current = executionData;
    onExecutionIdRef.current = onExecutionId;
  });

  useEffect(() => {
    const dispose = reaction(
      () => navigation.navigationPath.map((entry) => entry.displayName),
      (path, prevPath) => {
        if (isApplyingRef?.current) return;
        const resolved = resolveSubgraphExecutionId(
          path,
          prevPath,
          executionDataRef.current,
        );
        if (resolved.skip) return;
        onExecutionIdRef.current(resolved.executionId);
      },
    );
    return dispose;
  }, [navigation, isApplyingRef]);
}

interface UseRunViewSubgraphSyncOptions {
  /**
   * When embedded (Tangent workarea), subgraph context is tracked in React
   * state instead of the URL, so `onSubgraphExecutionIdChange` is called and
   * the URL is left untouched.
   */
  embedded?: boolean;
  onSubgraphExecutionIdChange?: (executionId: string | undefined) => void;
}

/**
 * Keeps the run's execution context aligned with the V2 navigation path when
 * entering/leaving subgraphs.
 *
 * On a full-page route it mirrors the path onto the URL `subgraphExecutionId`
 * (and syncs back from external URL changes). Embedded, it reports the resolved
 * execution id through `onSubgraphExecutionIdChange` so the caller can scope
 * `ExecutionDataProvider` without navigating away from the host page.
 *
 * Without this, subgraph navigation only updates `navigationStore.activeSpec`
 * (what the canvas renders) while `ExecutionDataProvider` stays scoped to the
 * root execution, so task status indicators and artifacts fail to resolve for
 * subgraph tasks. This mirrors V1 (`TaskNodeCard.handleDoubleClick`).
 */
export function useRunViewSubgraphSync({
  embedded = false,
  onSubgraphExecutionIdChange,
}: UseRunViewSubgraphSyncOptions = {}): void {
  const navigate = useNavigate();
  const { navigation } = useSharedStores();
  const executionData = useExecutionData();

  const params = useParams({ strict: false });
  const subgraphExecutionId =
    "subgraphExecutionId" in params &&
    typeof params.subgraphExecutionId === "string"
      ? params.subgraphExecutionId
      : undefined;

  const navigateRef = useRef(navigate);
  const executionDataRef = useRef(executionData);
  const onChangeRef = useRef(onSubgraphExecutionIdChange);

  useEffect(() => {
    navigateRef.current = navigate;
    executionDataRef.current = executionData;
    onChangeRef.current = onSubgraphExecutionIdChange;
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

  // Direction A: navigationStore path -> URL subgraphExecutionId (route), or
  // -> onSubgraphExecutionIdChange (embedded).
  useRunViewSubgraphExecutionSync(
    (executionId) => {
      if (embedded) {
        onChangeRef.current?.(executionId);
        return;
      }
      const runId = executionDataRef.current.runId;
      if (!runId) return;
      const target = getRunPath(runId, "v2", executionId);
      if (window.location.pathname === target) return;
      lastPushedExecutionId.current = executionId;
      navigateRef.current({ to: target });
    },
    { isApplyingFromUrl: embedded ? undefined : isApplyingFromUrl },
  );

  // Direction B: external URL subgraphExecutionId -> navigationStore path.
  // Unused when embedded (no URL drives the run).
  useEffect(() => {
    if (embedded) return;
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
  }, [embedded, subgraphExecutionId, executionData.segments, navigation]);
}

/** Full-page RunView route variant: mirrors subgraph navigation onto the URL. */
export function useRunViewSubgraphUrlSync(): void {
  useRunViewSubgraphSync({ embedded: false });
}
