import type { HostUIComponentProps } from "@tangent/embed-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useOpenWorkareaTarget } from "@/routes/v2/pages/Tangent/hooks/useOpenWorkareaTarget";
import {
  type SessionRun,
  useSessionRuns,
} from "@/routes/v2/pages/Tangent/hooks/useSessionRuns";
import { runTarget } from "@/services/projects/resourceTarget";
import {
  isRefusedRun,
  useRunsExecutionStats,
} from "@/services/projects/useProjectRuns";
import {
  getOverallExecutionStatusFromStats,
  isExecutionComplete,
  isFailedStatus,
  isInProgressStatus,
} from "@/utils/executionStatus";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

import { RunListItem } from "./RunListItem";

interface RunRow {
  run: SessionRun;
  running: boolean;
  failed: boolean;
  finished: boolean;
}

function pillLabel(rows: RunRow[]): string {
  const runs = rows.length === 1 ? "1 run" : `${rows.length} runs`;
  const running = rows.filter((row) => row.running).length;
  return running > 0 ? `${runs} · ${running} running` : runs;
}

/**
 * The chat's own runs, in a pill beside its agents: the runs it started or
 * brought in, each with its live status. A red dot says one failed, a pulsing
 * green one that one is running. Dismissing a run only hides it here; it stays
 * in the project's runs.
 */
export const ChatRunsPill = observer(function ChatRunsPill({
  props,
}: HostUIComponentProps) {
  const notify = useToastNotification();
  const openTarget = useOpenWorkareaTarget();
  const [open, setOpen] = useState(false);
  const sessionId =
    typeof props.sessionId === "string" ? props.sessionId : undefined;
  const { runs, dismiss } = useSessionRuns(sessionId);
  const shown = runs.filter((run) => !run.dismissed);
  const stats = useRunsExecutionStats(shown.map(({ id }) => id));

  if (shown.length === 0) {
    if (open) setOpen(false);
    return null;
  }

  const rows: RunRow[] = shown.map((run, index) => {
    const data = stats[index]?.data;
    const status = getOverallExecutionStatusFromStats(data);
    return {
      run,
      running: isInProgressStatus(status),
      failed: isFailedStatus(status),
      // A run the backend refuses, such as a deleted one, is over too.
      finished:
        Boolean(data && isExecutionComplete(data)) ||
        isRefusedRun(stats[index]?.error),
    };
  });
  const anyFailed = rows.some(({ failed }) => failed);
  const anyRunning = rows.some(({ running }) => running);
  const finished = rows.filter((row) => row.finished);

  function dismissRun(run: SessionRun) {
    dismiss(run).catch((error: unknown) =>
      notify(getErrorMessage(error), "error"),
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          aria-label={`${pillLabel(rows)}${anyFailed ? ", one failed" : ""}`}
          {...tracking("projects.chat.runs_pill.open")}
        >
          <Icon name="Play" size="xs" />
          {pillLabel(rows)}
          {(anyFailed || anyRunning) && (
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                anyFailed ? "bg-destructive" : "animate-pulse bg-success",
              )}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-1">
        <BlockStack gap="1" align="stretch">
          <InlineStack
            align="space-between"
            wrap="nowrap"
            className="px-2 pt-1"
          >
            <Text size="xs" weight="medium" tone="subdued">
              Runs in this chat
            </Text>
            {finished.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => finished.forEach(({ run }) => dismissRun(run))}
                {...tracking("projects.chat.runs_pill.clear_finished")}
              >
                Clear finished
              </Button>
            )}
          </InlineStack>
          <div className="reveal-scrollbar max-h-72 overflow-y-auto">
            <BlockStack as="ul" align="stretch">
              {rows.map(({ run }) => (
                <RunListItem
                  key={run.id}
                  runId={run.id}
                  name={run.name}
                  at={run.addedAt}
                  onOpen={(event) => {
                    setOpen(false);
                    void openTarget(runTarget(run.id), run.name, event);
                  }}
                  trackingId="projects.chat.runs_pill.open_run"
                  action={{
                    icon: "X",
                    label: `Dismiss ${run.name}`,
                    onClick: () => dismissRun(run),
                    tracking: tracking("projects.chat.runs_pill.dismiss"),
                  }}
                />
              ))}
            </BlockStack>
          </div>
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
});
