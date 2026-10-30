import type { ColoredIcon } from "./treeNodes.ts";

// Must match EXECUTION_STATUS_PRIORITY in the web app's
// src/utils/executionStatus.ts, so a run shows the same status in both places.
const STATUS_PRIORITY = [
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

const STATUS_LABELS: Record<string, string> = {
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
};

const FAILED_ICON = { id: "error", color: "testing.iconFailed" };
const WAITING_ICON = { id: "clock" };
const STOPPED_ICON = { id: "circle-slash" };

const STATUS_ICONS: Record<string, ColoredIcon> = {
  SUCCEEDED: { id: "pass", color: "testing.iconPassed" },
  FAILED: FAILED_ICON,
  SYSTEM_ERROR: FAILED_ICON,
  INVALID: { id: "warning", color: "problemsWarningIcon.foreground" },
  RUNNING: { id: "sync~spin" },
  PENDING: WAITING_ICON,
  QUEUED: WAITING_ICON,
  WAITING_FOR_UPSTREAM: WAITING_ICON,
  CANCELLING: STOPPED_ICON,
  CANCELLED: STOPPED_ICON,
  SKIPPED: { id: "debug-step-over" },
  UNINITIALIZED: { id: "circle-outline" },
};

const ACTIVE_STATUSES = new Set([
  "RUNNING",
  "PENDING",
  "QUEUED",
  "WAITING_FOR_UPSTREAM",
  "CANCELLING",
  "UNINITIALIZED",
]);

/** Whether a run can still change status, so it is worth polling. */
export function isRunActive(status: string | undefined): boolean {
  return status !== undefined && ACTIVE_STATUSES.has(status);
}

/** The status that best summarizes a run, from its per-status task counts. */
export function overallRunStatus(
  stats: Record<string, number> | null | undefined,
): string | undefined {
  if (!stats) return undefined;
  const prioritized = STATUS_PRIORITY.find(
    (status) => (stats[status] ?? 0) > 0,
  );
  if (prioritized) return prioritized;
  return Object.entries(stats).find(([, count]) => count > 0)?.[0];
}

export function runStatusLabel(status: string | undefined): string {
  if (!status) return "Unknown";
  return STATUS_LABELS[status] ?? status;
}

export function runStatusIcon(status: string | undefined): ColoredIcon {
  return (status && STATUS_ICONS[status]) || { id: "circle-large-outline" };
}
