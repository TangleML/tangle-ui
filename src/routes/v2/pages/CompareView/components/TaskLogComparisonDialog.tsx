import Logs, {
  OpenLogsInNewWindowLink,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/logs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { TaskDiff } from "@/routes/v2/pages/CompareView/utils/comparePipelines";
import { isGraphImplementation } from "@/utils/componentSpec";

import { RunTag } from "./RunTag";

interface TaskLogSide {
  executionId?: string;
  status?: string;
  canLog: boolean;
}

function toLogSide(
  spec: TaskDiff["a"],
  executionId: string | undefined,
  status: string | undefined,
): TaskLogSide {
  const isSubgraph = isGraphImplementation(
    spec?.componentRef.spec?.implementation,
  );
  return { executionId, status, canLog: Boolean(executionId) && !isSubgraph };
}

function taskLogSides(diff: TaskDiff): {
  a: TaskLogSide;
  b: TaskLogSide;
} {
  return {
    a: toLogSide(diff.a, diff.executionIdA, diff.statusA),
    b: toLogSide(diff.b, diff.executionIdB, diff.statusB),
  };
}

export function taskHasComparableLogs(diff: TaskDiff): boolean {
  const { a, b } = taskLogSides(diff);
  return a.canLog || b.canLog;
}

interface LogColumnProps {
  run: "a" | "b";
  label: string;
  runName: string;
  side: TaskLogSide;
}

function LogColumn({ run, label, runName, side }: LogColumnProps) {
  return (
    <BlockStack gap="2" className="min-h-0 min-w-0 flex-1">
      <InlineStack
        align="space-between"
        blockAlign="center"
        gap="2"
        wrap="nowrap"
        className="w-full"
      >
        <InlineStack
          gap="2"
          blockAlign="center"
          wrap="nowrap"
          className="min-w-0"
        >
          <RunTag run={run} label={label} />
          <Text as="span" size="sm" weight="semibold" className="truncate">
            {runName}
          </Text>
        </InlineStack>
        {side.canLog && side.executionId && (
          <OpenLogsInNewWindowLink
            executionId={side.executionId}
            status={side.status}
          />
        )}
      </InlineStack>
      <BlockStack
        align="stretch"
        className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border p-2"
      >
        {side.canLog && side.executionId ? (
          <Logs executionId={side.executionId} status={side.status} />
        ) : (
          <BlockStack fill>
            <Text as="span" size="sm" tone="subdued">
              {side.executionId
                ? "Subgraph tasks have no container logs."
                : `This task did not run in ${label}.`}
            </Text>
          </BlockStack>
        )}
      </BlockStack>
    </BlockStack>
  );
}

interface TaskLogComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diff: TaskDiff;
  taskName: string;
  labelA: string;
  labelB: string;
  nameA: string;
  nameB: string;
}

export function TaskLogComparisonDialog({
  open,
  onOpenChange,
  diff,
  taskName,
  labelA,
  labelB,
  nameA,
  nameB,
}: TaskLogComparisonDialogProps) {
  const { a, b } = taskLogSides(diff);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col sm:max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            <Text as="span" className="font-mono">
              {taskName}
            </Text>{" "}
            — logs
          </DialogTitle>
        </DialogHeader>
        <InlineStack
          gap="3"
          blockAlign="stretch"
          wrap="nowrap"
          className="min-h-0 w-full flex-1"
        >
          <LogColumn run="a" label={labelA} runName={nameA} side={a} />
          <LogColumn run="b" label={labelB} runName={nameB} side={b} />
        </InlineStack>
      </DialogContent>
    </Dialog>
  );
}
