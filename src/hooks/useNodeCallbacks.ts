import { type Node, useReactFlow } from "@xyflow/react";
import { useCallback } from "react";

import { getDeleteConfirmationDetails } from "@/components/shared/ReactFlow/FlowCanvas/ConfirmationDialogs/DeleteConfirmation";
import { getUpgradeConfirmationDetails } from "@/components/shared/ReactFlow/FlowCanvas/ConfirmationDialogs/UpgradeComponent";
import type { NodesAndEdges } from "@/components/shared/ReactFlow/FlowCanvas/types";
import { duplicateNodes } from "@/components/shared/ReactFlow/FlowCanvas/utils/duplicateNodes";
import { replaceTaskNode } from "@/components/shared/ReactFlow/FlowCanvas/utils/replaceTaskNode";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useComponentSpecStore } from "@/stores/componentSpecStore";
import type { Annotations } from "@/types/annotations";
import type { NodeAndTaskId } from "@/types/taskNode";
import type { ComponentReference, TaskSpec } from "@/utils/componentSpec";
import type { ArgumentType } from "@/utils/componentSpec";
import { updateSubgraphSpec } from "@/utils/subgraphUtils";

import type { TriggerDialogProps } from "./useConfirmationDialog";
import useToastNotification from "./useToastNotification";

interface UseNodeCallbacksProps {
  triggerConfirmation: (data: TriggerDialogProps) => Promise<boolean>;
  onElementsRemove: (params: NodesAndEdges) => void;
  updateOrAddNodes: (params: {
    updatedNodes?: Node[];
    newNodes?: Node[];
  }) => void;
}

export const useNodeCallbacks = ({
  triggerConfirmation,
  onElementsRemove,
  updateOrAddNodes,
}: UseNodeCallbacksProps) => {
  const notify = useToastNotification();
  const reactFlowInstance = useReactFlow();

  const {
    currentGraphSpec,
    currentSubgraphSpec,
    currentSubgraphPath,
    updateGraphSpec,
    componentSpec,
    setComponentSpec,
  } = useComponentSpec();

  // Workaround for nodes state being stale in task node callbacks
  const getNodeById = useCallback(
    (id: string) => {
      if (!reactFlowInstance) {
        console.warn("React Flow instance is not available.");
        return undefined;
      }

      const { getNodes } = reactFlowInstance;
      const nodes = getNodes();
      if (!nodes) {
        console.warn("No nodes found in the current React Flow instance.");
        return undefined;
      }

      const node = nodes.find((n) => n.id === id);
      if (!node) {
        console.warn(`Node with id ${id} not found.`);
        return undefined;
      }
      return node;
    },
    [reactFlowInstance],
  );

  const onDelete = useCallback(
    async (ids: NodeAndTaskId) => {
      const nodeId = ids.nodeId;

      const nodeToDelete = getNodeById(nodeId);

      if (!nodeToDelete) {
        console.warn(`Node with id ${nodeId} not found.`);
        return;
      }

      if (!reactFlowInstance) {
        console.warn("React Flow instance is not available.");
        return;
      }

      const currentEdges = reactFlowInstance.getEdges();

      const edgesToRemove = currentEdges.filter(
        (edge) => edge.source === nodeId || edge.target === nodeId,
      );

      const params = {
        nodes: [nodeToDelete],
        edges: edgesToRemove,
      } as NodesAndEdges;

      const confirmed = await triggerConfirmation(
        getDeleteConfirmationDetails(params),
      );

      if (confirmed) {
        onElementsRemove(params);
      }
    },
    [triggerConfirmation, onElementsRemove, getNodeById],
  );

  const setArguments = useCallback(
    (ids: NodeAndTaskId, args: Record<string, ArgumentType>) => {
      const taskId = ids.taskId;
      // Direct store mutation — granular update, no deep clone
      useComponentSpecStore
        .getState()
        .setTaskArguments(currentSubgraphPath, taskId, args);
      // Also update context for remaining consumers (shallow spread)
      const newGraphSpec = {
        ...currentGraphSpec,
        tasks: {
          ...currentGraphSpec.tasks,
          [taskId]: {
            ...currentGraphSpec.tasks[taskId],
            arguments: args,
          },
        },
      };
      updateGraphSpec(newGraphSpec);
    },
    [currentGraphSpec, currentSubgraphPath, updateGraphSpec],
  );

  const setAnnotations = useCallback(
    (ids: NodeAndTaskId, annotations: Annotations) => {
      const taskId = ids.taskId;
      // Direct store mutation — granular update
      useComponentSpecStore
        .getState()
        .setTaskAnnotations(currentSubgraphPath, taskId, annotations);
      // Also update context for remaining consumers (shallow spread)
      const newGraphSpec = {
        ...currentGraphSpec,
        tasks: {
          ...currentGraphSpec.tasks,
          [taskId]: {
            ...currentGraphSpec.tasks[taskId],
            annotations,
          },
        },
      };
      updateGraphSpec(newGraphSpec);
    },
    [currentGraphSpec, currentSubgraphPath, updateGraphSpec],
  );

  const setCacheStaleness = useCallback(
    (ids: NodeAndTaskId, cacheStaleness: string | undefined) => {
      const taskId = ids.taskId;
      const task = currentGraphSpec.tasks[taskId];

      if (!task) {
        console.warn(`Task with id ${taskId} not found in graph spec.`);
        return;
      }

      const cachingStrategy = cacheStaleness
        ? { maxCacheStaleness: cacheStaleness }
        : undefined;

      const updatedExecutionOptions = {
        ...task.executionOptions,
        cachingStrategy,
      };

      // Direct store mutation — granular update
      useComponentSpecStore
        .getState()
        .setTaskExecutionOptions(
          currentSubgraphPath,
          taskId,
          updatedExecutionOptions,
        );

      // Also update context for remaining consumers
      const updatedTask: TaskSpec = {
        ...task,
        executionOptions: updatedExecutionOptions,
      };

      const newGraphSpec = {
        ...currentGraphSpec,
        tasks: {
          ...currentGraphSpec.tasks,
          [taskId]: updatedTask,
        },
      };

      updateGraphSpec(newGraphSpec);
    },
    [currentGraphSpec, currentSubgraphPath, updateGraphSpec],
  );

  const onDuplicate = useCallback(
    (ids: NodeAndTaskId, selected = true) => {
      const nodeId = ids.nodeId;
      const node = getNodeById(nodeId);

      if (!node) {
        console.warn(`Node with id ${nodeId} not found.`);
        return;
      }

      const {
        updatedComponentSpec: updatedSubgraphSpec,
        newNodes,
        updatedNodes,
      } = duplicateNodes(currentSubgraphSpec, [node], { selected });

      const updatedRootSpec = updateSubgraphSpec(
        componentSpec,
        currentSubgraphPath,
        updatedSubgraphSpec,
      );

      setComponentSpec(updatedRootSpec);

      updateOrAddNodes({
        updatedNodes,
        newNodes,
      });
    },
    [
      componentSpec,
      currentSubgraphSpec,
      currentSubgraphPath,
      getNodeById,
      setComponentSpec,
      updateOrAddNodes,
    ],
  );

  const onUpgrade = useCallback(
    async (ids: NodeAndTaskId, newComponentRef: ComponentReference) => {
      const nodeId = ids.nodeId;
      const node = getNodeById(nodeId);

      if (!node) {
        console.warn(`Node with id ${nodeId} not found.`);
        return;
      }

      const { updatedGraphSpec, lostInputs } = replaceTaskNode(
        node.data.taskId as string,
        newComponentRef,
        currentGraphSpec,
      );

      if (!newComponentRef.digest) {
        console.error("Component reference does not have a digest.");
        return;
      }

      const taskId = node.data.taskId as string;
      const dialogData = getUpgradeConfirmationDetails(
        taskId,
        currentGraphSpec.tasks[taskId],
        newComponentRef.digest,
        lostInputs,
      );

      const confirmed = await triggerConfirmation(dialogData);

      if (confirmed) {
        updateGraphSpec(updatedGraphSpec);
        notify("Component updated", "success");
      }
    },
    [
      currentGraphSpec,
      getNodeById,
      updateGraphSpec,
      triggerConfirmation,
      notify,
    ],
  );

  return {
    onDelete,
    setArguments,
    setAnnotations,
    setCacheStaleness,
    onDuplicate,
    onUpgrade,
  };
};
