import { APP_ROUTES } from "./appRoutes";

export function getRunPath(
  runId: string | number,
  subgraphExecutionId?: string,
): string {
  const runPath = `${APP_ROUTES.RUNS}/${encodeURIComponent(runId)}`;
  return subgraphExecutionId
    ? `${runPath}/${encodeURIComponent(subgraphExecutionId)}`
    : runPath;
}

export function getDefaultRunPath(runId: string | number): string {
  return getRunPath(runId);
}

export function isRunViewPath(pathname: string): boolean {
  return pathname.startsWith(`${APP_ROUTES.RUNS}/`);
}
