import { APP_ROUTES } from "./appRoutes";

/**
 * Builds a run view path. Nested subgraphs are encoded as one path segment
 * per nesting level, outermost first:
 * `/runs/<runId>/<subgraph1ExecutionId>/<subgraph2ExecutionId>/...`.
 * A single id (legacy shape) is still accepted.
 */
export function getRunPath(
  runId: string | number,
  subgraphExecutionIds?: string | readonly string[],
): string {
  const runPath = `${APP_ROUTES.RUNS}/${encodeURIComponent(runId)}`;
  const ids = (
    typeof subgraphExecutionIds === "string"
      ? [subgraphExecutionIds]
      : (subgraphExecutionIds ?? [])
  ).filter(Boolean);

  return ids.length
    ? `${runPath}/${ids.map((id) => encodeURIComponent(id)).join("/")}`
    : runPath;
}

export function getDefaultRunPath(runId: string | number): string {
  return getRunPath(runId);
}

export function isRunViewPath(pathname: string): boolean {
  return pathname.startsWith(`${APP_ROUTES.RUNS}/`);
}

/**
 * Reads the subgraph execution id chain from run view route params. The
 * nested route is a splat (`/runs/$id/$`), so every segment after the run id
 * is one nesting level. The last id is the subgraph currently in view; the
 * ancestors before it are informational (the breadcrumbs are re-derived from
 * the leaf's execution ancestry, so a leaf-only URL still deep-links).
 */
export function getSubgraphExecutionIdsFromParams(
  params: Record<string, unknown>,
): string[] {
  if ("_splat" in params && typeof params._splat === "string") {
    return params._splat.split("/").filter(Boolean);
  }
  if (
    "subgraphExecutionId" in params &&
    typeof params.subgraphExecutionId === "string" &&
    params.subgraphExecutionId
  ) {
    return [params.subgraphExecutionId];
  }
  return [];
}

/** The subgraph execution id currently in view, or `undefined` at the root. */
export function getSubgraphExecutionIdFromParams(
  params: Record<string, unknown>,
): string | undefined {
  return getSubgraphExecutionIdsFromParams(params).at(-1);
}
