import type { MouseEvent } from "react";

import {
  ListItem,
  type ListItemAction,
  type ListItemFlair,
} from "@/components/ui/list-item";
import { resourceMeta } from "@/services/projects/resourceMeta";
import { useRunExecutionStats } from "@/services/projects/useProjectRuns";
import { formatRelativeTime } from "@/utils/date";
import {
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
  isFailedStatus,
  isInProgressStatus,
} from "@/utils/executionStatus";
import { tracking } from "@/utils/tracking";

/**
 * A pulsing green dot while the run is going, green once it succeeded, red
 * when it failed, and grey for anything else, such as a cancelled run.
 */
export function runStatusFlair(
  status: string | undefined,
): ListItemFlair | undefined {
  if (!status) return undefined;
  const label = getExecutionStatusLabel(status);
  if (isInProgressStatus(status)) {
    return { kind: "dot", label, tone: "success", pulse: true };
  }
  if (isFailedStatus(status)) return { kind: "dot", label, tone: "critical" };
  if (status === "SUCCEEDED") return { kind: "dot", label, tone: "success" };
  return { kind: "dot", label };
}

/** A pipeline run's row, with its live status. */
export function RunListItem({
  runId,
  name,
  at,
  action,
  onOpen,
  trackingId,
}: {
  runId: string;
  name: string;
  at: Date | null;
  action: ListItemAction;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  trackingId: string;
}) {
  const { data } = useRunExecutionStats(runId);

  return (
    <ListItem
      icon={resourceMeta("run").icon}
      title={name}
      subtitle={at ? formatRelativeTime(at) : undefined}
      flair={runStatusFlair(getOverallExecutionStatusFromStats(data))}
      onOpen={onOpen}
      tracking={tracking(trackingId)}
      actions={[action]}
    />
  );
}
