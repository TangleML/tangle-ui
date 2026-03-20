import type {
  ContainerExecutionStatus,
  GetContainerExecutionStateResponse,
} from "@/api/types.gen";
import { MINUTES } from "@/utils/constants";
import { formatDate } from "@/utils/date";

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

const EXPIRY_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export function addDaysAndFormat(
  isoString: string,
  offsetDays: number,
): string {
  const date = new Date(isoString);
  date.setDate(date.getDate() + offsetDays);
  return formatDate(date, EXPIRY_DATE_FORMAT);
}

export function isRecordWithString(
  obj: unknown,
  key: string,
): obj is Record<string, unknown> & Record<typeof key, string> {
  return (
    obj !== null &&
    typeof obj === "object" &&
    typeof (obj as Record<string, unknown>)[key] === "string"
  );
}

export function extractPodName(
  containerState: GetContainerExecutionStateResponse | undefined,
): string | null {
  const debugInfo = containerState?.debug_info;
  if (!debugInfo) return null;

  if (isRecordWithString(debugInfo, "pod_name")) {
    return debugInfo.pod_name;
  }

  const k8s = debugInfo.kubernetes;
  if (isRecordWithString(k8s, "pod_name")) {
    return k8s.pod_name;
  }

  return null;
}

// --- Resolver functions ---

const DEFAULT_FALLBACK_MINUTES = 60;
const RELATIVE_NOW = "now";

export function elapsedMinutesCeil(startIso: string): number {
  const elapsedMs = Date.now() - new Date(startIso).getTime();
  return Math.ceil(Math.max(elapsedMs, 0) / MINUTES);
}

export function resolvePodLogsHydrationReplacements(
  metadata: Record<string, unknown>,
  containerState: GetContainerExecutionStateResponse,
  podName: string,
): PodLogsHydrationReplacements {
  const paddingMinutes =
    typeof metadata.paddingMinutes === "number" ? metadata.paddingMinutes : 0;

  // No start — defensive fallback (LogsEventsOverlaySection guards against
  // this, so reaching here means something unexpected happened).
  if (!containerState.started_at) {
    console.warn(
      "[resolvePodLogsHydrationReplacements] started_at is missing — this should not happen",
    );
    return {
      podName,
      startTime: `${RELATIVE_NOW}-${DEFAULT_FALLBACK_MINUTES}m`,
      endTime: RELATIVE_NOW,
    };
  }

  // No end — task still running. Use relative time so Observe auto-refreshes.
  if (!containerState.ended_at) {
    const totalMinutes =
      elapsedMinutesCeil(containerState.started_at) + paddingMinutes;
    return {
      podName,
      startTime: `${RELATIVE_NOW}-${totalMinutes}m`,
      endTime: RELATIVE_NOW,
    };
  }

  // Both present — use absolute padded timestamps.
  // Cap endTime to "now" so we never request a future time range from Observe.
  const paddedEnd = adjustTimestamp(containerState.ended_at, paddingMinutes);
  const endTime =
    new Date(paddedEnd).getTime() > Date.now() ? RELATIVE_NOW : paddedEnd;

  return {
    podName,
    startTime: adjustTimestamp(containerState.started_at, -paddingMinutes),
    endTime,
  };
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
    ? addDaysAndFormat(containerState.started_at, retentionDays)
    : "Unknown";

  return { retentionDays, expiryDate };
}

export function resolveRunningHintHydrationReplacements(
  status: ContainerExecutionStatus | undefined,
): RunningHintHydrationReplacements {
  const isRunning = status === "RUNNING";
  return { isRunning };
}
