import { type Node, useReactFlow } from "@xyflow/react";

import { getDeleteConfirmationDetails } from "@/components/shared/ReactFlow/FlowCanvas/ConfirmationDialogs/DeleteConfirmation";
import { getUpgradeConfirmationDetails } from "@/components/shared/ReactFlow/FlowCanvas/ConfirmationDialogs/UpgradeComponent";
import type { NodesAndEdges } from "@/components/shared/ReactFlow/FlowCanvas/types";
import { duplicateNodes } from "@/components/shared/ReactFlow/FlowCanvas/utils/duplicateNodes";
import replaceTaskAnnotationsInGraphSpec from "@/components/shared/ReactFlow/FlowCanvas/utils/replaceTaskAnnotationsInGraphSpec";
import replaceTaskArgumentsInGraphSpec from "@/components/shared/ReactFlow/FlowCanvas/utils/replaceTaskArgumentsInGraphSpec";
import { replaceTaskNode } from "@/components/shared/ReactFlow/FlowCanvas/utils/replaceTaskNode";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
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
  const getNodeById = (id: string) => {
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
  };

  const onDelete = async (ids: NodeAndTaskId) => {
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
  };

  const setArguments = (
    ids: NodeAndTaskId,
    args: Record<string, ArgumentType>,
  ) => {
    const taskId = ids.taskId;
    const newGraphSpec = replaceTaskArgumentsInGraphSpec(
      taskId,
      currentGraphSpec,
      args,
    );
    updateGraphSpec(newGraphSpec);
  };

  const setAnnotations = (ids: NodeAndTaskId, annotations: Annotations) => {
    const taskId = ids.taskId;
    const newGraphSpec = replaceTaskAnnotationsInGraphSpec(
      taskId,
      currentGraphSpec,
      annotations,
    );
    updateGraphSpec(newGraphSpec);
  };

  const setCacheStaleness = (
    ids: NodeAndTaskId,
    cacheStaleness: string | undefined,
  ) => {
    const taskId = ids.taskId;
    const task = currentGraphSpec.tasks[taskId];

    if (!task) {
      console.warn(`Task with id ${taskId} not found in graph spec.`);
      return;
    }

    const cachingStrategy = cacheStaleness
      ? { maxCacheStaleness: cacheStaleness }
      : undefined;

    const updatedTask: TaskSpec = {
      ...task,
      executionOptions: {
        ...task.executionOptions,
        cachingStrategy,
      },
    };

    const newGraphSpec = {
      ...currentGraphSpec,
      tasks: {
        ...currentGraphSpec.tasks,
        [taskId]: updatedTask,
      },
    };

    updateGraphSpec(newGraphSpec);
  };

  const onDuplicate = (ids: NodeAndTaskId, selected = true) => {
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
  };

  const onUpgrade = async (
    ids: NodeAndTaskId,
    newComponentRef: ComponentReference,
  ) => {
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

    const dialogData = getUpgradeConfirmationDetails(
      node.data.taskId as string,
      node.data.taskSpec as TaskSpec | undefined,
      newComponentRef.digest,
      lostInputs,
    );

    const confirmed = await triggerConfirmation(dialogData);

    if (confirmed) {
      updateGraphSpec(updatedGraphSpec);
      notify("Component updated", "success");
    }
  };

  return {
    onDelete,
    setArguments,
    setAnnotations,
    setCacheStaleness,
    onDuplicate,
    onUpgrade,
  };
};
