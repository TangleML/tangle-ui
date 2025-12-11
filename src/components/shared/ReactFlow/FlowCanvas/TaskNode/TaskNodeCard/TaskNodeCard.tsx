import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import type { Action } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { PublishedComponentBadge } from "@/components/shared/ManageComponent/PublishedComponentBadge";
import { trimDigest } from "@/components/shared/ManageComponent/utils/digest";
import { useBetaFlagValue } from "@/components/shared/Settings/useBetaFlags";
import TaskStatusBar from "@/components/shared/Status/TaskStatusBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { QuickTooltip } from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { buildExecutionUrl } from "@/hooks/useSubgraphBreadcrumbs";
import { cn } from "@/lib/utils";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useContextPanel } from "@/providers/ContextPanelProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { useTaskNode } from "@/providers/TaskNodeProvider";
import { isCacheDisabled } from "@/utils/cache";
import type { ExecutionStatusStats } from "@/utils/executionStatus";
import { getSubgraphDescription, isSubgraph } from "@/utils/subgraphUtils";

import {
  type NotifyMessage,
  type UpdateOverlayMessage,
  useNodesOverlay,
} from "../../../NodesOverlay/NodesOverlayProvider";
import TaskOverview from "../TaskOverview";
import { TaskNodeInputs } from "./TaskNodeInputs";
import { TaskNodeOutputs } from "./TaskNodeOutputs";
import { UpgradeNodePopover } from "./UpgradeNodePopover";

const TaskNodeCard = () => {
  const navigate = useNavigate();
  const isRemoteComponentLibrarySearchEnabled = useBetaFlagValue(
    "remote-component-library-search",
  );
  const isSubgraphNavigationEnabled = useBetaFlagValue("subgraph-navigation");
  const { registerNode } = useNodesOverlay();
  const taskNode = useTaskNode();
  const {
    setContent,
    clearContent,
    setOpen: setContextPanelOpen,
  } = useContextPanel();
  const { navigateToSubgraph } = useComponentSpec();
  const executionData = useExecutionDataOptional();
  const rootExecutionId = executionData?.rootExecutionId;
  const details = executionData?.details;
  const executionState = executionData?.state;

  const nodeRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [isYamlFullscreen, setIsYamlFullscreen] = useState(false);
  const [updateOverlayDialogOpen, setUpdateOverlayDialogOpen] = useState<
    UpdateOverlayMessage["data"] | undefined
  >();
  const [highlightedState, setHighlighted] = useState(false);

  const [scrollHeight, setScrollHeight] = useState(0);
  const [condensed, setCondensed] = useState(false);
  const [expandedInputs, setExpandedInputs] = useState(false);
  const [expandedOutputs, setExpandedOutputs] = useState(false);

  const { name, state, callbacks, nodeId, taskSpec, taskId } = taskNode;
  const { dimensions, selected, highlighted, isCustomComponent, readOnly } =
    state;

  const isSubgraphNode = useMemo(() => {
    if (!taskSpec) return false;
    return isSubgraph(taskSpec);
  }, [taskSpec]);

  const subgraphExecutionStats = useMemo((): ExecutionStatusStats | null => {
    if (!isSubgraphNode || !taskId) return null;

    const executionId = details?.child_task_execution_ids?.[taskId];
    if (!executionId) return null;

    const stats = executionState?.child_execution_status_stats?.[executionId];
    if (!stats) return null;

    return stats;
  }, [isSubgraphNode, taskId, details, executionState]);

  const subgraphDescription = useMemo(() => {
    if (!taskSpec) return "";
    return getSubgraphDescription(taskSpec);
  }, [taskSpec]);

  const disabledCache = isCacheDisabled(taskSpec);

  const onNotify = useCallback((message: NotifyMessage) => {
    switch (message.type) {
      case "highlight":
        setHighlighted(true);
        break;
      case "clear":
        setHighlighted(false);
        break;
      case "update-overlay":
        setHighlighted(true);
        setUpdateOverlayDialogOpen({
          ...message.data,
        });
        break;
    }
  }, []);

  useEffect(() => {
    if (!taskSpec) return;
    return registerNode({
      nodeId,
      taskSpec,
      onNotify,
    });
  }, [registerNode, nodeId, taskSpec, onNotify]);

  const closeOverlayPopover = useCallback((open: boolean) => {
    setHighlighted(open);

    if (!open) {
      setUpdateOverlayDialogOpen(undefined);
    }
  }, []);

  const handleDuplicateTask = useCallback(() => {
    callbacks.onDuplicate?.();
  }, [callbacks]);

  const handleUpgradeTask = useCallback(() => {
    callbacks.onUpgrade?.();
  }, [callbacks]);

  const handleEnterSubgraph = useCallback(() => {
    if (taskId) {
      navigateToSubgraph(taskId);
    }
  }, [navigateToSubgraph, taskId]);

  const taskConfigMarkup = useMemo(() => {
    const customActions: Action[] = [
      {
        label: "Duplicate Task",
        icon: "Copy",
        hidden: readOnly,
        onClick: handleDuplicateTask,
      },
      {
        label: "Update Task from Source URL",
        icon: "CircleFadingArrowUp",
        hidden: readOnly || isCustomComponent,
        onClick: handleUpgradeTask,
      },
      {
        label: `Enter Subgraph: ${subgraphDescription}`,
        icon: "Workflow",
        hidden: !isSubgraphNode || !isSubgraphNavigationEnabled,
        onClick: handleEnterSubgraph,
      },
      {
        label: "View YAML",
        icon: "FileCodeCorner",
        onClick: () => setIsYamlFullscreen(true),
      },
    ];

    return (
      <TaskOverview
        key={nodeId}
        taskNode={taskNode}
        customActions={customActions}
      />
    );
  }, [
    taskNode,
    nodeId,
    readOnly,
    isCustomComponent,
    isSubgraphNode,
    taskId,
    subgraphDescription,
    navigateToSubgraph,
    isSubgraphNavigationEnabled,
  ]);

  const handleInputSectionClick = useCallback(() => {
    setExpandedInputs((prev) => !prev);
  }, []);

  const handleOutputSectionClick = useCallback(() => {
    setExpandedOutputs((prev) => !prev);
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (isSubgraphNode && taskId && isSubgraphNavigationEnabled) {
      navigateToSubgraph(taskId);

      if (rootExecutionId && details?.child_task_execution_ids) {
        const subgraphExecutionId = details.child_task_execution_ids[taskId];
        if (subgraphExecutionId) {
          const url = buildExecutionUrl(rootExecutionId, subgraphExecutionId);
          navigate({ to: url });
        }
      }
    }
  }, [
    isSubgraphNode,
    taskId,
    navigateToSubgraph,
    isSubgraphNavigationEnabled,
    rootExecutionId,
    details,
    navigate,
  ]);

  useEffect(() => {
    if (nodeRef.current) {
      setScrollHeight(nodeRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    if (!dimensions.h) {
      setCondensed(false);
      return;
    }

    if (contentRef.current && scrollHeight > 0) {
      setCondensed(scrollHeight > dimensions.h);
    }
  }, [scrollHeight, dimensions.h]);

  useEffect(() => {
    if (selected) {
      setContent(taskConfigMarkup);
      setContextPanelOpen(true);
    }

    return () => {
      if (selected) {
        clearContent();
      }
    };
  }, [
    selected,
    taskConfigMarkup,
    setContent,
    clearContent,
    setContextPanelOpen,
  ]);

  if (!taskSpec) {
    return null;
  }

  const digestMarkup = taskSpec.componentRef?.digest && (
    <QuickTooltip content={taskSpec.componentRef.digest}>
      <div className="text-xs font-light font-mono">
        {trimDigest(taskSpec.componentRef.digest)}
      </div>
    </QuickTooltip>
  );

  const componentText = taskSpec.componentRef?.text;

  return (
    <>
      <Card
        className={cn(
          "rounded-2xl border-gray-200 border-2 wrap-break-word p-0 drop-shadow-none gap-2",
          selected ? "border-gray-500" : "hover:border-slate-200",
          (highlighted || highlightedState) && "border-orange-500!",
          isSubgraphNode && "cursor-pointer",
        )}
        style={{
          width: dimensions.w + "px",
          height: condensed || !dimensions.h ? "auto" : dimensions.h + "px",
          transition: "height 0.2s",
        }}
        ref={nodeRef}
        onDoubleClick={handleDoubleClick}
      >
        <CardHeader className="border-b border-slate-200 px-2 py-2.5 flex flex-row justify-between items-start">
          <BlockStack>
            <InlineStack gap="2" wrap="nowrap">
              {isSubgraphNode && isSubgraphNavigationEnabled && (
                <QuickTooltip content={`Subgraph: ${subgraphDescription}`}>
                  <Icon name="Workflow" size="sm" className="text-blue-600" />
                </QuickTooltip>
              )}
              {disabledCache && !readOnly && (
                <QuickTooltip
                  content="Cache Disabled"
                  className="whitespace-nowrap"
                >
                  <Icon name="ZapOff" size="sm" className="text-orange-400" />
                </QuickTooltip>
              )}
              <CardTitle className="wrap-break-word text-left text-xs text-slate-900">
                {name}
              </CardTitle>
            </InlineStack>
            {taskId &&
              taskId !== name &&
              !taskId.match(new RegExp(`^${name}\\s*\\d+$`)) && (
                <Text size="xs" tone="subdued" className="font-light">
                  {taskId}
                </Text>
              )}
          </BlockStack>

          {isRemoteComponentLibrarySearchEnabled ? (
            <PublishedComponentBadge componentRef={taskSpec.componentRef}>
              {digestMarkup}
            </PublishedComponentBadge>
          ) : (
            digestMarkup
          )}
        </CardHeader>
        <CardContent className="p-2 flex flex-col gap-2">
          {isSubgraphNode && subgraphExecutionStats && (
            <TaskStatusBar executionStatusStats={subgraphExecutionStats} />
          )}
          <div
            style={{
              maxHeight:
                dimensions.h && !(expandedInputs || expandedOutputs)
                  ? `${dimensions.h}px`
                  : "100%",
            }}
            className="min-h-fit"
            ref={contentRef}
          >
            <TaskNodeInputs
              condensed={condensed}
              expanded={expandedInputs}
              onBackgroundClick={handleInputSectionClick}
            />

            <TaskNodeOutputs
              condensed={condensed}
              expanded={expandedOutputs}
              onBackgroundClick={handleOutputSectionClick}
            />
          </div>
          {isRemoteComponentLibrarySearchEnabled && updateOverlayDialogOpen ? (
            <UpgradeNodePopover
              currentNode={taskNode}
              onOpenChange={closeOverlayPopover}
              {...updateOverlayDialogOpen}
            />
          ) : null}
        </CardContent>
      </Card>
      {isYamlFullscreen && componentText && (
        <CodeViewer
          code={componentText}
          language="yaml"
          filename={name}
          isFullscreen={isYamlFullscreen}
          onClose={() => setIsYamlFullscreen(false)}
        />
      )}
    </>
  );
};

export default TaskNodeCard;
