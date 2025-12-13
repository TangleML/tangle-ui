import type { ContainerExecutionStatus } from "@/api/types.gen";

type ExecutionStatusStats = Record<string, number> | undefined;

const CONTAINER_EXECUTION_STATUSES: ReadonlySet<ContainerExecutionStatus> =
  new Set<ContainerExecutionStatus>([
    "INVALID",
    "UNINITIALIZED",
    "QUEUED",
    "WAITING_FOR_UPSTREAM",
    "PENDING",
    "RUNNING",
    "SUCCEEDED",
    "FAILED",
    "SYSTEM_ERROR",
    "CANCELLING",
    "CANCELLED",
    "SKIPPED",
  ]);

export function isContainerExecutionStatus(
  value: string,
): value is ContainerExecutionStatus {
  return CONTAINER_EXECUTION_STATUSES.has(value as ContainerExecutionStatus);
}

/**
 * User-facing label for execution/node statuses.
 *
 * Note: Per `tangle-ui#1540`, we display real status names (e.g. "Waiting for upstream").
 * Per the current decision, SYSTEM_ERROR is displayed as "Failed".
 */
export function getExecutionStatusLabel(
  status: ContainerExecutionStatus,
): string {
  switch (status) {
    case "QUEUED":
      return "Queued";
    case "WAITING_FOR_UPSTREAM":
      return "Waiting for upstream";
    case "PENDING":
    case "UNINITIALIZED":
      return "Pending";
    case "RUNNING":
      return "Running";
    case "SUCCEEDED":
      return "Succeeded";
    case "FAILED":
    case "SYSTEM_ERROR":
    case "INVALID":
      return "Failed";
    case "CANCELLING":
      return "Cancelling";
    case "CANCELLED":
      return "Cancelled";
    case "SKIPPED":
      return "Skipped";
  }
}

type Counts = Record<ContainerExecutionStatus, number>;

const EMPTY_COUNTS: Counts = {
  INVALID: 0,
  UNINITIALIZED: 0,
  QUEUED: 0,
  WAITING_FOR_UPSTREAM: 0,
  PENDING: 0,
  RUNNING: 0,
  SUCCEEDED: 0,
  FAILED: 0,
  SYSTEM_ERROR: 0,
  CANCELLING: 0,
  CANCELLED: 0,
  SKIPPED: 0,
};

function getCounts(stats: ExecutionStatusStats): Counts {
  if (!stats) return EMPTY_COUNTS;

  const counts: Counts = { ...EMPTY_COUNTS };

  for (const [status, rawCount] of Object.entries(stats)) {
    if (!isContainerExecutionStatus(status)) continue;
    const count = typeof rawCount === "number" && rawCount > 0 ? rawCount : 0;
    counts[status] += count;
  }

  return counts;
}

/**
 * Derives a single task/node status from an execution status histogram.
 *
 * This is needed because some tasks represent subgraphs, where multiple child nodes
 * can be in different states; we pick a "dominant" status using a consistent priority.
 */
export function deriveExecutionStatusFromStats(
  stats: ExecutionStatusStats,
): ContainerExecutionStatus | undefined {
  const counts = getCounts(stats);

  const totalKnown = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (totalKnown === 0) return undefined;

  const failedLike = counts.FAILED + counts.SYSTEM_ERROR + counts.INVALID;

  // Priority (highest → lowest):
  // cancelling > cancelled > failed > running > pending > waiting_for_upstream > queued > skipped > succeeded
  if (counts.CANCELLING > 0) return "CANCELLING";
  if (counts.CANCELLED > 0) return "CANCELLED";
  if (failedLike > 0) return "FAILED";
  if (counts.RUNNING > 0) return "RUNNING";
  if (counts.PENDING + counts.UNINITIALIZED > 0) return "PENDING";
  if (counts.WAITING_FOR_UPSTREAM > 0) return "WAITING_FOR_UPSTREAM";
  if (counts.QUEUED > 0) return "QUEUED";
  if (counts.SKIPPED > 0) return "SKIPPED";

  if (counts.SUCCEEDED > 0 && counts.SUCCEEDED === totalKnown)
    return "SUCCEEDED";

  // Fall back to pending for any remaining/unknown mixes (should be rare).
  return "PENDING";
}
