import { useMemo } from "react";

import { useTrackRecentlyViewedRun } from "@/hooks/useTrackRecentlyViewedRun";
import type { ComponentSpec } from "@/models/componentSpec";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { deserializeRunSpec } from "@/routes/v2/pages/RunView/deserializeRunSpec";
import { getBackendStatusString } from "@/utils/backend";
import { RemoteAuthError } from "@/utils/fetchWithErrorHandling";

export type RunViewLoadState =
  | { status: "spec"; spec: ComponentSpec }
  | { status: "loading" }
  | { status: "not-configured" }
  | { status: "not-available" }
  | { status: "auth-error" }
  | { status: "error"; error: Error; backendStatus: string }
  | { status: "empty" };

export function useRunViewLoadState(runId: string): RunViewLoadState {
  const { configured, available, ready } = useBackend();
  const { details, state, rootDetails, rootState, isLoading, error } =
    useExecutionData();

  useTrackRecentlyViewedRun(
    runId,
    rootDetails?.task_spec.componentRef.spec?.name,
  );

  const rootSpec = rootDetails?.task_spec.componentRef.spec;
  // eslint-disable-next-line no-restricted-syntax -- preserve the model identity across execution polling
  const spec = useMemo(
    () => (rootSpec ? deserializeRunSpec(rootSpec) : null),
    [rootSpec],
  );

  // Keep the canvas during refreshes, once the initial execution state exists.
  if (spec && rootState) return { status: "spec", spec };
  if (isLoading || !ready) return { status: "loading" };
  if (!configured) return { status: "not-configured" };
  if (!available) return { status: "not-available" };

  if (error) {
    if (error instanceof RemoteAuthError) return { status: "auth-error" };
    return {
      status: "error",
      error,
      backendStatus: getBackendStatusString(configured, available),
    };
  }

  if (!details || !state) return { status: "loading" };

  return { status: "empty" };
}
