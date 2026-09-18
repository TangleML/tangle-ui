import { useParams } from "@tanstack/react-router";
import { AmphoraIcon, InfoIcon, LogsIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import type { ContainerExecutionStatus } from "@/api/types.gen";
import IOSection from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOSection";
import Logs, {
  OpenLogsInNewWindowLink,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/logs";
import { LogsEventsOverlaySection } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/LogsEventsOverlaySection";
import { RemoteTroubleshootButton } from "@/components/shared/RemoteTroubleshootAction/RemoteTroubleshootButton";
import { StatusIcon } from "@/components/shared/Status";
import TaskDetails from "@/components/shared/TaskDetails/Details";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { useContainerLog } from "@/hooks/useContainerLog";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { TaskSpec } from "@/utils/componentSpec";
import { tracking } from "@/utils/tracking";

import { getLogsWindowSize } from "./logsWindowSize";
import { RunViewTaskActions } from "./RunViewTaskActions";
import { getTaskAnnotationSections } from "./RunViewTaskAnnotations";

const DEFAULT_TAB = "artifacts";

const LOGS_MIN_DOCKED_HEIGHT = 280;

interface RunViewTaskDetailsProps {
  entityId: string;
}

export const RunViewTaskDetails = observer(function RunViewTaskDetails({
  entityId,
}: RunViewTaskDetailsProps) {
  const { track } = useAnalytics();
  const spec = useSpec();
  const executionData = useExecutionDataOptional();
  const { editor, windows } = useSharedStores();
  const params = useParams({ strict: false });
  const runId =
    "id" in params && typeof params.id === "string" ? params.id : undefined;

  const task = spec?.tasks.find((t) => t.$id === entityId);
  const isSubgraphTask = task?.subgraphSpec !== undefined;
  const hasLogsTab = !!task && !isSubgraphTask;

  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);

  useEffect(() => {
    setActiveTab(DEFAULT_TAB);
  }, [entityId]);

  const pendingTab = editor.pendingTaskDetailTab;
  useEffect(() => {
    if (!pendingTab) return;
    if (pendingTab !== "logs" || hasLogsTab) {
      setActiveTab(pendingTab);
    }
    editor.setPendingTaskDetailTab(null);
  }, [pendingTab, hasLogsTab, editor]);

  const status = task
    ? executionData?.taskExecutionStatusMap.get(task.name)
    : undefined;
  const executionId = task
    ? executionData?.details?.child_task_execution_ids?.[task.name]
    : undefined;

  // Scoped to the logs tab: there it shares the cache entry the nested <Logs>
  // populates, so sizing the pop-out window costs no request. Unscoped it would
  // fetch and poll logs for every task the user merely selects.
  const { data: containerLog } = useContainerLog(executionId, status, {
    enabled: activeTab === "logs",
  });

  if (!task) {
    return (
      <BlockStack className="p-4">
        <Text size="sm" tone="subdued">
          Task not found
        </Text>
      </BlockStack>
    );
  }

  const componentRef = task.resolvedComponentRef;

  const taskSpecForIO = { componentRef } as TaskSpec;

  const handlePopOutLogs = () => {
    if (!executionId) return;
    windows.openWindow(
      <Logs
        executionId={executionId}
        status={status}
        allowFullscreen={false}
        headerActions={
          <OpenLogsInNewWindowLink
            executionId={executionId}
            status={status}
            iconOnly
            {...tracking("v2.run_view.context_panel.open_logs_new_tab")}
          />
        }
      />,
      {
        id: `task-logs-${task.name}`,
        title: `Logs: ${task.name}`,
        size: getLogsWindowSize(
          [containerLog?.log_text, containerLog?.system_error_exception_full],
          { width: window.innerWidth, height: window.innerHeight },
        ),
        minDockedHeight: LOGS_MIN_DOCKED_HEIGHT,
      },
    );
  };

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

      {runId && (
        <RemoteTroubleshootButton
          runId={runId}
          executionId={executionId}
          taskName={task.name}
          status={status}
        />
      )}

      <div className="overflow-y-auto pb-4 h-full w-full">
        <Tabs
          value={activeTab}
          className="h-full"
          onValueChange={(nextTab) => {
            setActiveTab(nextTab);
            track("v2.run_view.context_panel.task_detail_tab.select", {
              active_tab: nextTab,
            });
          }}
        >
          <TabsList className="mb-2 w-full">
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
              additionalSection={getTaskAnnotationSections(task.annotations)}
            />
          </TabsContent>

          {!isSubgraphTask && (
            <TabsContent value="logs">
              <LogsEventsOverlaySection
                executionId={executionId}
                status={status as ContainerExecutionStatus}
              />
              <Logs
                executionId={executionId}
                status={status}
                headerActions={({ exitFullscreen }) =>
                  !!executionId && (
                    <>
                      <Button
                        variant="ghost"
                        size="min"
                        onClick={() => {
                          // The floating window would otherwise open behind the
                          // fullscreen overlay that spawned it.
                          exitFullscreen();
                          handlePopOutLogs();
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        title="Pop out logs"
                        aria-label="Pop out logs"
                        {...tracking("v2.run_view.context_panel.logs_pop_out")}
                      >
                        <Icon name="PictureInPicture2" />
                      </Button>
                      <OpenLogsInNewWindowLink
                        executionId={executionId}
                        status={status}
                        iconOnly
                        {...tracking(
                          "v2.run_view.context_panel.open_logs_new_tab",
                        )}
                      />
                    </>
                  )
                }
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </BlockStack>
  );
});
