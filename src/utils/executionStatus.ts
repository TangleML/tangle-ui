import type {
  ContainerExecutionStatus,
  GetGraphExecutionStateResponse,
} from "@/api/types.gen";

/**
 * Server execution status → display label mapping.
 *
 * Note: The mapping is intentionally aligned to the status table from:
 * https://github.com/TangleML/tangle-ui/issues/1540
 */
const EXECUTION_STATUS_LABELS: Record<string, string> = {
  CANCELLED: "Cancelled",
  CANCELLING: "Cancelling",
  FAILED: "Failed",
  INVALID: "Invalid",
  PENDING: "Pending",
  QUEUED: "Queued",
  RUNNING: "Running",
  SKIPPED: "Skipped",
  SUCCEEDED: "Succeeded",
  SYSTEM_ERROR: "System error",
  UNINITIALIZED: "Uninitialized",
  WAITING_FOR_UPSTREAM: "Waiting for upstream",
} as const satisfies Record<ContainerExecutionStatus, string>;

/**
 * Centralized background color mapping for status bar segments.
 */
export const EXECUTION_STATUS_BG_COLORS: Record<string, string> = {
  SUCCEEDED: "bg-green-500",
  FAILED: "bg-red-500",
  SYSTEM_ERROR: "bg-red-700",
  INVALID: "bg-red-600",
  RUNNING: "bg-blue-500",
  PENDING: "bg-yellow-500",
  QUEUED: "bg-amber-500",
  WAITING_FOR_UPSTREAM: "bg-slate-500",
  SKIPPED: "bg-slate-400",
  CANCELLED: "bg-gray-700",
  CANCELLING: "bg-gray-500",
  UNINITIALIZED: "bg-yellow-400",
};

/**
 * Statuses considered "in progress" (not terminal).
 */
const IN_PROGRESS_STATUSES = new Set([
  "RUNNING",
  "PENDING",
  "QUEUED",
  "WAITING_FOR_UPSTREAM",
  "CANCELLING",
  "UNINITIALIZED",
]);

/**
 * Priority order for determining overall/aggregate execution status.
 * Higher priority statuses appear first — if any task has SYSTEM_ERROR,
 * the overall status should reflect that before checking for FAILED, etc.
 */
const EXECUTION_STATUS_PRIORITY = [
  "SYSTEM_ERROR",
  "FAILED",
  "INVALID",
  "CANCELLING",
  "CANCELLED",
  "RUNNING",
  "PENDING",
  "WAITING_FOR_UPSTREAM",
  "QUEUED",
  "UNINITIALIZED",
  "SKIPPED",
  "SUCCEEDED",
] as const;

export type ExecutionStatusStats = Record<string, number>;

type ChildExecutionStatusStats =
  GetGraphExecutionStateResponse["child_execution_status_stats"];

export function getExecutionStatusLabel(status: string | undefined): string {
  if (!status) return "Unknown";
  return EXECUTION_STATUS_LABELS[status] ?? status;
}

/**
 * Flatten nested child_execution_status_stats into a single aggregated stats object.
 */
export function flattenExecutionStatusStats(
  childStats: ChildExecutionStatusStats | null | undefined,
): ExecutionStatusStats {
  if (!childStats) return {};

  const result: ExecutionStatusStats = {};
  for (const stats of Object.values(childStats)) {
    if (!stats) continue;
    for (const [status, count] of Object.entries(stats)) {
      if (count) {
        result[status] = (result[status] ?? 0) + count;
      }
    }
  }
  return result;
}

/**
 * Find the first status in the priority list that has a non-zero count.
 */
const pickHighestPriorityStatus = (
  stats: Record<string, number | null | undefined>,
): string | undefined =>
  EXECUTION_STATUS_PRIORITY.find((status) => (stats[status] ?? 0) > 0);

/**
 * Pick the highest priority status from a stats object.
 * Returns the raw server status - use getExecutionStatusLabel() for display.
 */
export function getOverallExecutionStatusFromStats(
  stats: Record<string, number | null | undefined> | null | undefined,
): string | undefined {
  if (!stats) return undefined;

  const picked = pickHighestPriorityStatus(stats);
  if (picked) return picked;

  // Fallback: return any status with a non-zero count
  const firstNonZero = Object.entries(stats).find(([, c]) => (c ?? 0) > 0);
  return firstNonZero?.[0];
}

/**
 * Count the number of in-progress tasks from execution stats.
 */
export function countInProgressFromStats(stats: ExecutionStatusStats): number {
  let count = 0;
  for (const status of IN_PROGRESS_STATUSES) {
    count += stats[status] ?? 0;
  }
  return count;
}

/**
 * Check if execution is complete based on stats (no in-progress tasks and at least one task).
 */
export function isExecutionComplete(stats: ExecutionStatusStats): boolean {
  const total = Object.values(stats).reduce((sum, c) => sum + (c ?? 0), 0);
  return total > 0 && countInProgressFromStats(stats) === 0;
}
