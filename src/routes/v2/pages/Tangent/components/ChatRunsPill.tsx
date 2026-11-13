import type { HostUIComponentProps } from "@tangent/embed-react";
import { observer } from "mobx-react-lite";
import { type MouseEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ListItem, type ListItemFlair } from "@/components/ui/list-item";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { getDefaultRunPath } from "@/routes/runRoutes";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  type SessionRun,
  useSessionRuns,
} from "@/routes/v2/pages/Tangent/hooks/useSessionRuns";
import { runTarget } from "@/services/projects/resourceTarget";
import {
  isRefusedRun,
  useRunsExecutionStats,
} from "@/services/projects/useProjectRuns";
import { formatRelativeTime } from "@/utils/date";
import { hasNewTabModifier } from "@/utils/dom";
import {
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
  isExecutionComplete,
  isInProgressStatus,
} from "@/utils/executionStatus";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

const FAILED_STATUSES = new Set([
  "FAILED",
  "UPSTREAM_FAILED",
  "UPSTREAM_FAILED_OR_SKIPPED",
  "SYSTEM_ERROR",
  "INVALID",
]);

type RunState = "running" | "failed" | "done" | "unknown";

interface RunRow {
  run: SessionRun;
  state: RunState;
  label: string;
  finished: boolean;
}

function stateOf(status: string | undefined): RunState {
  if (!status) return "unknown";
  if (isInProgressStatus(status)) return "running";
  if (FAILED_STATUSES.has(status)) return "failed";
  return "done";
}

function flairOf({ state, label }: RunRow): ListItemFlair | undefined {
  if (state === "unknown") return undefined;
  if (state === "running") {
    return { kind: "dot", label, tone: "success", pulse: true };
  }
  if (state === "failed") return { kind: "dot", label, tone: "critical" };
  return { kind: "dot", label, tone: "success" };
}

function pillLabel(rows: RunRow[]): string {
  const runs = rows.length === 1 ? "1 run" : `${rows.length} runs`;
  const running = rows.filter(({ state }) => state === "running").length;
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
  const store = useTangentProject();
  const notify = useToastNotification();
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
    const status = data ? getOverallExecutionStatusFromStats(data) : undefined;
    return {
      run,
      state: stateOf(status),
      label: getExecutionStatusLabel(status),
      // A run the backend refuses, such as a deleted one, is over too.
      finished:
        Boolean(data && isExecutionComplete(data)) ||
        isRefusedRun(stats[index]?.error),
    };
  });
  const anyFailed = rows.some(({ state }) => state === "failed");
  const anyRunning = rows.some(({ state }) => state === "running");
  const finished = rows.filter((row) => row.finished);

  function dismissRun(run: SessionRun) {
    dismiss(run).catch((error: unknown) =>
      notify(getErrorMessage(error), "error"),
    );
  }

  async function openRun(run: SessionRun, event: MouseEvent) {
    setOpen(false);
    if (hasNewTabModifier(event)) {
      window.open(getDefaultRunPath(run.id), "_blank");
      return;
    }
    try {
      await store.openWorkareaTarget(runTarget(run.id), run.name);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
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
              {rows.map((row) => (
                <ListItem
                  key={row.run.id}
                  density="compact"
                  icon="Play"
                  title={row.run.name}
                  subtitle={formatRelativeTime(row.run.addedAt)}
                  flair={flairOf(row)}
                  onOpen={(event) => void openRun(row.run, event)}
                  tracking={tracking("projects.chat.runs_pill.open_run")}
                  actions={[
                    {
                      icon: "X",
                      label: `Dismiss ${row.run.name}`,
                      onClick: () => dismissRun(row.run),
                      tracking: tracking("projects.chat.runs_pill.dismiss"),
                    },
                  ]}
                />
              ))}
            </BlockStack>
          </div>
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
});
