import { APP_ROUTES } from "./appRoutes";

export function getRunPath(
  runId: string | number,
  subgraphExecutionIds: readonly string[] = [],
): string {
  const runPath = `${APP_ROUTES.RUNS}/${encodeURIComponent(runId)}`;
  const ids = subgraphExecutionIds.filter(Boolean);

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
 * Only the last id decides what the run view shows: breadcrumbs are rebuilt
 * from that execution's ancestry, so a link carrying just the innermost id
 * still opens the right subgraph.
 */
export function getSubgraphExecutionIdsFromParams(
  params: Record<string, unknown>,
): string[] {
  const splat = params._splat;
  return typeof splat === "string" ? splat.split("/").filter(Boolean) : [];
}

export function getSubgraphExecutionIdFromParams(
  params: Record<string, unknown>,
): string | undefined {
  return getSubgraphExecutionIdsFromParams(params).at(-1);
}
