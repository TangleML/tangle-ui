import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@xyflow/react";
import { CircleFadingArrowUp, CopyIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TooltipButtonProps } from "@/components/shared/Buttons/TooltipButton";
import { ComponentEditorDialog } from "@/components/shared/ComponentEditor/ComponentEditorDialog";
import { PublishedComponentBadge } from "@/components/shared/ManageComponent/PublishedComponentBadge";
import { trimDigest } from "@/components/shared/ManageComponent/utils/digest";
import { useBetaFlagValue } from "@/components/shared/Settings/useBetaFlags";
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
  const isInAppEditorEnabled = useBetaFlagValue("in-app-component-editor");
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

  const isDragging = useStore((state) => {
    const thisNode = state.nodes.find((node) => node.id === taskNode.nodeId);
    return thisNode?.dragging || false;
  });

  const nodeRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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

  const handleEditComponent = useCallback(() => {
    setIsEditDialogOpen(true);
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
  }, []);

  const taskConfigMarkup = useMemo(() => {
    const actions: Array<TooltipButtonProps> = [];

    if (!readOnly) {
      actions.push(
        {
          children: (
            <div className="flex items-center gap-2">
              <CopyIcon />
            </div>
          ),
          variant: "outline",
          tooltip: "Duplicate Task",
          onClick: callbacks.onDuplicate,
        },
        {
          children: (
            <div className="flex items-center gap-2">
              <CircleFadingArrowUp />
            </div>
          ),
          variant: "outline",
          className: cn(isCustomComponent && "hidden"),
          tooltip: "Update Task from Source URL",
          onClick: callbacks.onUpgrade,
        },
      );
    }

    if (isSubgraphNode && taskId && isSubgraphNavigationEnabled) {
      actions.push({
        children: (
          <div className="flex items-center gap-2">
            <Icon name="Workflow" size="sm" />
          </div>
        ),
        variant: "outline",
        tooltip: `Enter Subgraph: ${subgraphDescription}`,
        onClick: () => navigateToSubgraph(taskId),
      });
    }

    if (isInAppEditorEnabled) {
      actions.push({
        children: (
          <div className="flex items-center gap-2">
            <Icon name="FilePenLine" size="sm" />
          </div>
        ),
        variant: "outline",
        tooltip: "Edit Component Definition",
        onClick: handleEditComponent,
      });
    }

    return <TaskOverview taskNode={taskNode} key={nodeId} actions={actions} />;
  }, [
    nodeId,
    readOnly,
    callbacks.onDuplicate,
    callbacks.onUpgrade,
    isInAppEditorEnabled,
    isCustomComponent,
    isSubgraphNode,
    taskId,
    subgraphDescription,
    navigateToSubgraph,
    handleEditComponent,
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
    if (contentRef.current && scrollHeight > 0 && dimensions.h) {
      setCondensed(scrollHeight > dimensions.h);
    }
  }, [scrollHeight, dimensions.h]);

  useEffect(() => {
    if (selected && !isDragging) {
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
            <InlineStack gap="2" blockAlign="center" wrap="nowrap">
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
          <div
            style={{
              maxHeight:
                dimensions.h && !(expandedInputs || expandedOutputs)
                  ? `${dimensions.h}px`
                  : "100%",
            }}
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
      {isEditDialogOpen && (
        <ComponentEditorDialog
          text={taskSpec.componentRef?.text}
          onClose={handleCloseEditDialog}
        />
      )}
    </>
  );
};

export default TaskNodeCard;
