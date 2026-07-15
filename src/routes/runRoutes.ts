import { isFlagEnabled } from "@/components/shared/Settings/useFlags";

import { APP_ROUTES } from "./appRoutes";

export type RunViewVersion = "v1" | "v2";

export function getRunPath(
  runId: string | number,
  version: RunViewVersion,
  subgraphExecutionId?: string,
): string {
  const basePath = version === "v2" ? APP_ROUTES.RUNS_V2 : APP_ROUTES.RUNS;
  const runPath = `${basePath}/${encodeURIComponent(runId)}`;
  return subgraphExecutionId
    ? `${runPath}/${encodeURIComponent(subgraphExecutionId)}`
    : runPath;
}

export function getDefaultRunPath(runId: string | number): string {
  return getRunPath(runId, isFlagEnabled("v2_editor") ? "v2" : "v1");
}
