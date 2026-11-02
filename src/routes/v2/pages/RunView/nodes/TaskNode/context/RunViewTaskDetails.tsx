import { useParams } from "@tanstack/react-router";
import { AmphoraIcon, InfoIcon, LogsIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import type { ContainerExecutionStatus } from "@/api/types.gen";
import {
  type CodeViewerHeaderActions,
  CodeViewerHeaderButton,
} from "@/components/shared/CodeViewer";
import IOSection from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOSection";
import Logs, {
  OpenLogsInNewWindowLink,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/logs";
import { LogsEventsOverlaySection } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/LogsEventsOverlaySection";
import { RemoteTroubleshootButton } from "@/components/shared/RemoteTroubleshootAction/RemoteTroubleshootButton";
import { StatusIcon } from "@/components/shared/Status";
import TaskDetails from "@/components/shared/TaskDetails/Details";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
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
import { getTaskAnnotationSections } from "./RunViewTaskAnnotations";
import { RunViewTaskComponent } from "./RunViewTaskComponent";

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

  const taskSpecForIO = {
    componentRef,
    arguments: Object.fromEntries(
      task.arguments.flatMap((argument) =>
        argument.value === undefined ? [] : [[argument.name, argument.value]],
      ),
    ),
  } as TaskSpec;

  const openLogsInNewTabAction = executionId ? (
    <OpenLogsInNewWindowLink
      executionId={executionId}
      status={status}
      iconOnly
      {...tracking("v2.run_view.context_panel.open_logs_new_tab")}
    />
  ) : null;

  const handlePopOutLogs = () => {
    if (!executionId) return;
    windows.openWindow(
      <Logs
        executionId={executionId}
        status={status}
        allowFullscreen={false}
        headerActions={openLogsInNewTabAction}
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

  const logsHeaderActions: CodeViewerHeaderActions = ({ exitFullscreen }) => {
    if (!executionId) return null;

    return (
      <>
        <CodeViewerHeaderButton
          onClick={() => {
            exitFullscreen();
            handlePopOutLogs();
          }}
          title="Pop out logs"
          aria-label="Pop out logs"
          {...tracking("v2.run_view.context_panel.logs_pop_out")}
        >
          <Icon name="PictureInPicture2" />
        </CodeViewerHeaderButton>
        {openLogsInNewTabAction}
      </>
    );
  };

  return (
    <BlockStack
      className="h-full min-h-0 w-full"
      data-context-panel="task-overview"
    >
      <BlockStack gap="2" className="shrink-0 px-4 pt-3 pb-2">
        <InlineStack gap="2" blockAlign="center" wrap="nowrap">
          {isSubgraphTask && (
            <Icon name="Workflow" size="sm" className="shrink-0" />
          )}
          <Text
            size="md"
            weight="semibold"
            className="min-w-0 wrap-anywhere select-text"
          >
            {task.name}
          </Text>
          <StatusIcon status={status} tooltip label="task" />
        </InlineStack>

        <RunViewTaskComponent
          componentRef={componentRef}
          taskName={task.name}
        />

        {runId && (
          <RemoteTroubleshootButton
            runId={runId}
            executionId={executionId}
            taskName={task.name}
            status={status}
          />
        )}
      </BlockStack>

      <Separator />

      <div className="min-h-0 w-full flex-1 overflow-y-auto px-4 pt-2 pb-4">
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
                headerActions={logsHeaderActions}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </BlockStack>
  );
});
