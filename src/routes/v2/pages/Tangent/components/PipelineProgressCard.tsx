import type { HostUIComponentProps } from "@tangent/embed-react";
import { useQuery } from "@tanstack/react-query";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import TaskStatusBar from "@/components/shared/Status/TaskStatusBar";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useOpenWorkareaTarget } from "@/routes/v2/pages/Tangent/hooks/useOpenWorkareaTarget";
import { useRecordSessionRun } from "@/routes/v2/pages/Tangent/hooks/useSessionRuns";
import { fetchExecutionDetails } from "@/services/executionService";
import { runTarget } from "@/services/projects/resourceTarget";
import { useRunExecutionStats } from "@/services/projects/useProjectRuns";
import {
  countInProgressFromStats,
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";
import { tracking } from "@/utils/tracking";

function stringProp(
  props: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = props[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function progressLabel(stats: Record<string, number> | null | undefined) {
  if (!stats) return "Loading status…";
  const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
  const ended = total - countInProgressFromStats(stats);
  const status = getExecutionStatusLabel(
    getOverallExecutionStatusFromStats(stats),
  );
  return total > 0 ? `${status} — ${ended}/${total} tasks` : status;
}

/**
 * The page's own `tangent-ui:pipeline-progress` card, drawn instead of the
 * agent bundle's: it opens the run beside the chat on a click, the way a run
 * link does, rather than sending the agent a message asking it to.
 */
export const PipelineProgressCard = observer(function PipelineProgressCard({
  props,
}: HostUIComponentProps) {
  const store = useTangentProject();
  const openTarget = useOpenWorkareaTarget();
  const { backendUrl } = useBackend();
  const recordSessionRun = useRecordSessionRun();
  const executionId = stringProp(props, "executionId");
  const givenRunId = stringProp(props, "runId");

  const { data: details } = useQuery({
    queryKey: ["tangent-execution-details", executionId],
    queryFn: () => fetchExecutionDetails(executionId ?? "", backendUrl),
    enabled: Boolean(executionId) && !givenRunId,
    staleTime: Infinity,
  });
  const runId = givenRunId ?? details?.pipeline_run_id ?? undefined;
  const title =
    stringProp(props, "title") ??
    details?.task_spec?.componentRef?.spec?.name ??
    "Pipeline run";
  const { data: stats } = useRunExecutionStats(runId);
  const sessionId = store.activeSessionId;
  const recorded = useRef<string | null>(null);

  // A card for a run is how the chat learns the agent started it, so the run
  // joins the chat's runs once its id is known; a new title isn't news.
  useEffect(() => {
    if (!runId || !sessionId) return;
    const key = `${sessionId}:${runId}`;
    if (recorded.current === key) return;
    recorded.current = key;
    void recordSessionRun(sessionId, runId, title).catch(() => undefined);
  }, [runId, sessionId, title, recordSessionRun]);

  return (
    <button
      type="button"
      disabled={!runId}
      title={runId ? "Open this run beside the chat" : undefined}
      onClick={(event) => {
        if (runId) void openTarget(runTarget(runId), title, event);
      }}
      className="my-1 flex w-full cursor-pointer flex-col gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-background"
      {...tracking("projects.chat.pipeline_progress.open_run")}
    >
      <InlineStack gap="2" wrap="nowrap" className="w-full">
        <Icon name="GitBranch" size="sm" className="shrink-0" />
        <Text size="sm" weight="medium" className="min-w-0 flex-1 truncate">
          {title}
        </Text>
        <Icon
          name="ChevronRight"
          size="sm"
          className="shrink-0 text-muted-foreground"
        />
      </InlineStack>
      <BlockStack gap="1" align="stretch" className="w-full">
        <TaskStatusBar executionStatusStats={stats} />
        <Text size="xs" tone="subdued">
          {progressLabel(stats)}
        </Text>
      </BlockStack>
    </button>
  );
});
