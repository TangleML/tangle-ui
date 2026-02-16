import type { GetContainerExecutionStateResponse } from "@/api/types.gen";

/**
 * Extracts the Kubernetes pod name from a container execution state's debug_info.
 * Checks both `debug_info.pod_name` and `debug_info.kubernetes.pod_name`.
 */
export function executionPodName(
  containerState?: GetContainerExecutionStateResponse,
): string | null {
  if (!containerState || !("debug_info" in containerState)) {
    return null;
  }

  const debugInfo = containerState.debug_info;

  if (!isRecord(debugInfo)) {
    return null;
  }

  if (typeof debugInfo.pod_name === "string") {
    return debugInfo.pod_name;
  }

  if (
    isRecord(debugInfo.kubernetes) &&
    typeof debugInfo.kubernetes.pod_name === "string"
  ) {
    return debugInfo.kubernetes.pod_name;
  }

  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
