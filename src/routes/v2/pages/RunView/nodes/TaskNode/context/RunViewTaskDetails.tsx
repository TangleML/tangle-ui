import { AmphoraIcon, InfoIcon, LogsIcon } from "lucide-react";
import { observer } from "mobx-react-lite";

import type { ContainerExecutionStatus } from "@/api/types.gen";
import IOSection from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOSection";
import Logs, {
  OpenLogsInNewWindowLink,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/logs";
import { LogsEventsOverlaySection } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/LogsEventsOverlaySection";
import { StatusIcon } from "@/components/shared/Status";
import TaskDetails from "@/components/shared/TaskDetails/Details";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import type { TaskSpec } from "@/utils/componentSpec";

import { RunViewTaskActions } from "./RunViewTaskActions";

interface RunViewTaskDetailsProps {
  entityId: string;
}

export const RunViewTaskDetails = observer(function RunViewTaskDetails({
  entityId,
}: RunViewTaskDetailsProps) {
  const spec = useSpec();
  const executionData = useExecutionDataOptional();

  const task = spec?.tasks.find((t) => t.$id === entityId);

  if (!task) {
    return (
      <BlockStack className="p-4">
        <Text size="sm" tone="subdued">
          Task not found
        </Text>
      </BlockStack>
    );
  }

  const status = executionData?.taskExecutionStatusMap.get(task.name);
  const executionId =
    executionData?.details?.child_task_execution_ids?.[task.name];

  const componentRef = task.componentRef;
  const isSubgraphTask =
    !!task.componentRef.spec?.implementation &&
    "graph" in task.componentRef.spec.implementation;

  const taskSpecForIO = { componentRef } as TaskSpec;

  return (
    <BlockStack
      gap="4"
      className="h-full px-2"
      data-context-panel="task-overview"
    >
      <InlineStack gap="2">
        {isSubgraphTask && <Icon name="Workflow" />}
        <Text size="lg" weight="semibold" className="wrap-anywhere">
          {task.name}
        </Text>
        <StatusIcon status={status} tooltip label="task" />
      </InlineStack>

      <RunViewTaskActions componentRef={componentRef} taskName={task.name} />

      <div className="overflow-y-auto pb-4 h-full w-full">
        <Tabs defaultValue="artifacts" className="h-full">
          <TabsList className="mb-2">
            <TabsTrigger value="artifacts" className="flex-1">
              <AmphoraIcon className="w-4 h-4" />
              Artifacts
            </TabsTrigger>
            <TabsTrigger value="details" className="flex-1">
              <InfoIcon className="h-4 w-4" />
              Details
            </TabsTrigger>
            {!isSubgraphTask && (
              <TabsTrigger value="logs" className="flex-1">
                <LogsIcon className="h-4 w-4" />
                Logs
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="artifacts">
            <IOSection
              taskSpec={taskSpecForIO}
              readOnly
              executionId={executionId}
            />
          </TabsContent>

          <TabsContent value="details">
            <TaskDetails
              componentRef={componentRef}
              executionId={executionId}
              status={status}
              readOnly
              options={{ descriptionExpanded: true }}
            />
          </TabsContent>

          {!isSubgraphTask && (
            <TabsContent value="logs">
              {!!executionId && (
                <div className="flex w-full justify-end pr-4">
                  <OpenLogsInNewWindowLink
                    executionId={executionId}
                    status={status}
                  />
                </div>
              )}
              <LogsEventsOverlaySection
                executionId={executionId}
                status={status as ContainerExecutionStatus}
              />
              <Logs executionId={executionId} status={status} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </BlockStack>
  );
});
