import { useEffect, useRef, useState } from "react";

import { useTrackRecentlyViewedRun } from "@/hooks/useTrackRecentlyViewedRun";
import type { ComponentSpec } from "@/models/componentSpec";
import { useBackend } from "@/providers/BackendProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionData } from "@/providers/ExecutionDataProvider";
import { deserializeRunSpec } from "@/routes/v2/pages/RunView/deserializeRunSpec";
import { getBackendStatusString } from "@/utils/backend";
import type { ComponentSpec as DomainComponentSpec } from "@/utils/componentSpec";
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
  const { setComponentSpec, clearComponentSpec } = useComponentSpec();
  const { configured, available, ready } = useBackend();
  const { details, state, rootDetails, isLoading, error } = useExecutionData();

  useTrackRecentlyViewedRun(
    runId,
    rootDetails?.task_spec.componentRef.spec?.name,
  );

  const [spec, setSpec] = useState<ComponentSpec | null>(null);
  const deserializedRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (rootDetails?.task_spec.componentRef.spec) {
      // API response uses ComponentSpecOutput (name: string | null | undefined)
      // while the domain type uses ComponentSpec (name: string | undefined).
      // The null case is handled at runtime by downstream consumers.
      setComponentSpec(
        rootDetails.task_spec.componentRef.spec as DomainComponentSpec,
      );
    }

    return () => {
      clearComponentSpec();
    };
  }, [rootDetails, setComponentSpec, clearComponentSpec]);

  useEffect(() => {
    const rootSpec = rootDetails?.task_spec.componentRef.spec;
    if (!rootSpec || deserializedRunIdRef.current === runId) return;

    deserializedRunIdRef.current = runId;
    setSpec(deserializeRunSpec(rootSpec));
  }, [rootDetails, runId]);

  useEffect(
    () => () => {
      deserializedRunIdRef.current = null;
      setSpec(null);
    },
    [runId],
  );

  if (spec) return { status: "spec", spec };
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
