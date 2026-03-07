import type {
  ContainerExecutionStatus,
  GetContainerExecutionStateResponse,
} from "@/api/types.gen";

// --- Per-block typed replacement types ---
// Using `type` (not `interface`) so these are assignable to
// BlockHydrationReplacements (Record<string, ...>) without an index signature.

type PodLogsHydrationReplacements = {
  podName: string;
  startTime: string;
  endTime: string;
};

type RetentionNoticeHydrationReplacements = {
  retentionDays: number;
  expiryDate: string;
};

type RunningHintHydrationReplacements = {
  isRunning: boolean;
};

// --- Helpers ---

// TODO: Test if backend returns timestamps without timezone suffix (e.g. "2024-01-01T00:00:00"
// instead of "2024-01-01T00:00:00Z"). If so, uncomment utcTimezoneWorkaround and its usages
// in adjustTimestamp below. Remove this workaround once backend saves timezone-aware timestamps.
// function utcTimezoneWorkaround(timestamp: string): string {
//   const hasTimezone = /Z|[+-]\d{2}:\d{2}$/.test(timestamp);
//   return hasTimezone ? timestamp : timestamp + "Z";
// }

function adjustTimestamp(isoString: string, offsetMinutes: number): string {
  // TODO: Needs testing — if backend timestamps lack timezone, use utcTimezoneWorkaround here:
  // const date = new Date(utcTimezoneWorkaround(isoString));
  const date = new Date(isoString);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  // TODO: Needs testing — original code normalizes to ".000Z" suffix:
  // return date.toISOString().replace(/\.\d{3}Z$/, ".000Z");
  return date.toISOString();
}

function formatLocaleDate(isoString: string, offsetDays: number): string {
  const date = new Date(isoString);
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function extractPodName(
  containerState: GetContainerExecutionStateResponse | undefined,
): string | null {
  const debugInfo = containerState?.debug_info;
  if (!debugInfo || typeof debugInfo !== "object") return null;

  if (typeof (debugInfo as Record<string, unknown>).pod_name === "string") {
    return (debugInfo as Record<string, unknown>).pod_name as string;
  }

  const k8s = (debugInfo as Record<string, unknown>).kubernetes;
  if (
    k8s &&
    typeof k8s === "object" &&
    typeof (k8s as Record<string, unknown>).pod_name === "string"
  ) {
    return (k8s as Record<string, unknown>).pod_name as string;
  }

  return null;
}

// --- Resolver functions ---

export function resolvePodLogsHydrationReplacements(
  metadata: Record<string, unknown>,
  containerState: GetContainerExecutionStateResponse,
  podName: string,
): PodLogsHydrationReplacements {
  const paddingMinutes =
    typeof metadata.paddingMinutes === "number" ? metadata.paddingMinutes : 0;

  // started_at should always be present — LogsEventsOverlaySection guards
  // against null before calling this resolver. Fallback is purely defensive.
  if (!containerState.started_at) {
    console.warn(
      "[resolvePodLogsHydrationReplacements] started_at is missing — this should not happen",
    );
  }
  const startTime = containerState.started_at
    ? adjustTimestamp(containerState.started_at, -paddingMinutes)
    : new Date().toISOString();

  const endTime = containerState.ended_at
    ? adjustTimestamp(containerState.ended_at, paddingMinutes)
    : adjustTimestamp(new Date().toISOString(), paddingMinutes);

  return { podName, startTime, endTime };
}

export function resolveRetentionNoticeHydrationReplacements(
  metadata: Record<string, unknown>,
  containerState: GetContainerExecutionStateResponse,
): RetentionNoticeHydrationReplacements {
  if (typeof metadata.retentionDays !== "number") {
    console.warn(
      "[resolveRetentionNoticeHydrationReplacements] retentionDays missing from metadata — defaulting to 0",
    );
  }
  const retentionDays =
    typeof metadata.retentionDays === "number" ? metadata.retentionDays : 0;

  const expiryDate = containerState.started_at
    ? formatLocaleDate(containerState.started_at, retentionDays)
    : "Unknown";

  return { retentionDays, expiryDate };
}

export function resolveRunningHintHydrationReplacements(
  status: ContainerExecutionStatus | undefined,
): RunningHintHydrationReplacements {
  const isRunning = status === "RUNNING";
  return { isRunning };
}
