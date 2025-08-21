import {
  AmphoraIcon,
  FilePenLineIcon,
  InfoIcon,
  LogsIcon,
  Parentheses,
} from "lucide-react";

import type { TooltipButtonProps } from "@/components/shared/Buttons/TooltipButton";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { ComponentDetailsDialog } from "@/components/shared/Dialogs";
import { ComponentFavoriteToggle } from "@/components/shared/FavoriteComponentToggle";
import { StatusIcon } from "@/components/shared/Status";
import {
  TaskDetails,
  TaskImplementation,
} from "@/components/shared/TaskDetails";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/typography";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { type TaskNodeContextType } from "@/providers/TaskNodeProvider";
import { isGraphImplementation } from "@/utils/componentSpec";

import ArgumentsSection from "../ArgumentsEditor/ArgumentsSection";
import ConfigurationSection from "./ConfigurationSection";
import IOSection from "./IOSection/IOSection";
import Logs, { OpenLogsInNewWindowLink } from "./logs";
import OutputsList from "./OutputsList";

interface TaskOverviewProps {
  taskNode: TaskNodeContextType;
  actions?: TooltipButtonProps[];
}

const TaskOverview = ({ taskNode, actions }: TaskOverviewProps) => {
  const { name, taskSpec, taskId, state, callbacks } = taskNode;

  const executionData = useExecutionDataOptional();
  const details = executionData?.details;

  const { readOnly, status } = state;
  const disabled = !!status;

  if (!taskSpec || !taskId) {
    return null;
  }

  const componentSpec = taskSpec.componentRef.spec;

  if (!componentSpec) {
    console.error(
      "TaskOverview called with missing taskSpec.componentRef.spec",
    );
    return null;
  }

  const isSubgraph = isGraphImplementation(componentSpec.implementation);
  const executionId = details?.child_task_execution_ids?.[taskId];

  return (
    <BlockStack className="h-full" data-context-panel="task-overview">
      <InlineStack gap="2" blockAlign="center" className="px-2 pb-2">
        <Text size="lg" weight="semibold">
          {name}
        </Text>
        <ComponentFavoriteToggle component={taskSpec.componentRef} hideDelete />
        <ComponentDetailsDialog
          displayName={name}
          component={taskSpec.componentRef}
        />
        {readOnly && <StatusIcon status={status} tooltip label="task" />}
      </InlineStack>

      <div className="px-4 overflow-y-auto pb-4 h-full w-full">
        <Tabs defaultValue="io" className="h-full">
          <TabsList className="mb-2">
            <TabsTrigger value="io" className="flex-1">
              {readOnly ? (
                <AmphoraIcon className="w-4 h-4" />
              ) : (
                <Parentheses className="w-4 h-4" />
              )}
              {readOnly ? "Artifacts" : "Arguments"}
            </TabsTrigger>
            <TabsTrigger value="details" className="flex-1">
              <InfoIcon className="h-4 w-4" />
              Details
            </TabsTrigger>

            {readOnly && !isSubgraph && (
              <TabsTrigger value="logs" className="flex-1">
                <LogsIcon className="h-4 w-4" />
                Logs
              </TabsTrigger>
            )}
            {!readOnly && (
              <TabsTrigger value="configuration" className="flex-1">
                <FilePenLineIcon className="h-4 w-4" />
                Configuration
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="details">
            <TaskDetails
              displayName={name}
              executionId={executionId}
              componentSpec={componentSpec}
              taskId={taskId}
              componentDigest={taskSpec.componentRef.digest}
              url={taskSpec.componentRef.url}
              onDelete={callbacks.onDelete}
              status={status}
              hasDeletionConfirmation={false}
              readOnly={readOnly}
              additionalSection={[
                {
                  title: "Component YAML",
                  isCollapsed: true,
                  component: (
                    <div className="h-[512px]">
                      <TaskImplementation
                        key="task-implementation"
                        displayName={name}
                        componentSpec={componentSpec}
                      />
                    </div>
                  ),
                },
              ]}
              actions={actions?.map((action) => (
                <TooltipButton {...action} key={action.tooltip?.toString()} />
              ))}
            />
          </TabsContent>
          <TabsContent value="io">
            {!readOnly && (
              <>
                <ArgumentsSection
                  taskSpec={taskSpec}
                  setArguments={callbacks.setArguments}
                  disabled={disabled}
                />
                <hr />
                <OutputsList taskSpec={taskSpec} />
              </>
            )}
            {readOnly && (
              <IOSection
                taskSpec={taskSpec}
                readOnly={readOnly}
                executionId={executionId}
              />
            )}
          </TabsContent>
          {readOnly && !isSubgraph && (
            <TabsContent value="logs">
              {!!executionId && (
                <div className="flex w-full justify-end pr-4">
                  <OpenLogsInNewWindowLink
                    executionId={executionId}
                    status={status}
                  />
                </div>
              )}
              <Logs executionId={executionId} status={status} />
            </TabsContent>
          )}
          {!readOnly && (
            <TabsContent value="configuration">
              <ConfigurationSection taskNode={taskNode} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </BlockStack>
  );
};

export default TaskOverview;
