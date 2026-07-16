import { DiffEditor } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";

import type { GetContainerExecutionLogResponse } from "@/api/types.gen";
import { InfoBox } from "@/components/shared/InfoBox";
import { OpenLogsInNewWindowLink } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/logs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import type { TaskDiff } from "@/routes/v2/pages/CompareView/utils/comparePipelines";
import { fetchContainerLog } from "@/services/executionService";
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

/**
 * Log comparison is only meaningful when both runs executed this task and the
 * task changed or produced a different outcome. Added/removed tasks (present in
 * only one run) have nothing to diff.
 */
export function taskHasComparableLogs(diff: TaskDiff): boolean {
  const { a, b } = taskLogSides(diff);
  return (
    a.canLog && b.canLog && (diff.status === "changed" || diff.outcomeChanged)
  );
}

function composeLogText(
  data: GetContainerExecutionLogResponse | undefined,
): string {
  if (!data) return "";
  const parts: string[] = [];
  if (data.log_text) parts.push(data.log_text);
  if (data.system_error_exception_full) {
    parts.push(`=== System error ===\n${data.system_error_exception_full}`);
  }
  return parts.join("\n\n").trim();
}

function useSideLog(side: TaskLogSide, backendUrl: string) {
  return useQuery({
    queryKey: ["logs", side.executionId],
    queryFn: () => fetchContainerLog(String(side.executionId), backendUrl),
    enabled: side.canLog && !!side.executionId,
  });
}

interface LogHeaderSideProps {
  run: "a" | "b";
  label: string;
  runName: string;
  side: TaskLogSide;
}

function LogHeaderSide({ run, label, runName, side }: LogHeaderSideProps) {
  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      wrap="nowrap"
      className="min-w-0 flex-1"
    >
      <RunTag run={run} label={label} />
      <Text as="span" size="sm" weight="semibold" className="truncate">
        {runName}
      </Text>
      {side.executionId && (
        <OpenLogsInNewWindowLink
          executionId={side.executionId}
          status={side.status}
        />
      )}
    </InlineStack>
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
  const { backendUrl } = useBackend();
  const { a, b } = taskLogSides(diff);

  const queryA = useSideLog(a, backendUrl);
  const queryB = useSideLog(b, backendUrl);

  const textA = composeLogText(queryA.data);
  const textB = composeLogText(queryB.data);

  const isLoading =
    (a.canLog && queryA.isLoading) || (b.canLog && queryB.isLoading);
  const bothEmpty = !textA && !textB;

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
        <InlineStack gap="3" wrap="nowrap" className="w-full">
          <LogHeaderSide run="a" label={labelA} runName={nameA} side={a} />
          <LogHeaderSide run="b" label={labelB} runName={nameB} side={b} />
        </InlineStack>
        <BlockStack
          align="stretch"
          className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border"
        >
          {isLoading ? (
            <BlockStack fill align="center" inlineAlign="center" gap="2">
              <Spinner />
              <Text as="span" size="sm" tone="subdued">
                Loading logs…
              </Text>
            </BlockStack>
          ) : bothEmpty ? (
            <BlockStack
              fill
              align="center"
              inlineAlign="center"
              className="p-4"
            >
              <InfoBox title="No logs" variant="info">
                Neither run produced container logs for this task.
              </InfoBox>
            </BlockStack>
          ) : (
            <DiffEditor
              original={textA}
              modified={textB}
              language="text"
              theme="vs-dark"
              options={{
                readOnly: true,
                renderSideBySide: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: "on",
                renderOverviewRuler: false,
                scrollbar: {
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                },
              }}
            />
          )}
        </BlockStack>
      </DialogContent>
    </Dialog>
  );
}
