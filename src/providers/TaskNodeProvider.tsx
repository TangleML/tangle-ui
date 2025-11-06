import { useReactFlow } from "@xyflow/react";
import { type ReactNode, useCallback, useMemo } from "react";

import type { ContainerExecutionStatus } from "@/api/types.gen";
import useComponentFromUrl from "@/hooks/useComponentFromUrl";
import { useTaskNodeDimensions } from "@/hooks/useTaskNodeDimensions";
import useToastNotification from "@/hooks/useToastNotification";
import type { Annotations } from "@/types/annotations";
import type { TaskNodeData, TaskNodeDimensions } from "@/types/taskNode";
import type {
  ArgumentType,
  InputSpec,
  OutputSpec,
  TaskSpec,
} from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";
import { taskIdToNodeId } from "@/utils/nodes/nodeIdUtils";

import {
  createRequiredContext,
  useRequiredContext,
} from "../hooks/useRequiredContext";

type TaskNodeState = Readonly<{
  selected: boolean;
  highlighted: boolean;
  readOnly: boolean;
  disabled: boolean;
  connectable: boolean;
  status?: ContainerExecutionStatus;
  isCustomComponent: boolean;
  dimensions: TaskNodeDimensions;
}>;

type TaskNodeCallbacks = {
  setArguments: (args: Record<string, ArgumentType>) => void;
  setAnnotations: (annotations: Annotations) => void;
  setCacheStaleness: (cacheStaleness: string | undefined) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onUpgrade?: () => void;
};

type TaskNodeProviderProps = {
  children: ReactNode;
  data: TaskNodeData;
  selected: boolean;
  status?: ContainerExecutionStatus;
};

export type TaskNodeContextType = {
  taskSpec?: TaskSpec;
  taskId?: string;
  nodeId: string;
  inputs: InputSpec[];
  outputs: OutputSpec[];
  name: string;
  state: TaskNodeState;
  callbacks: TaskNodeCallbacks;
  select: () => void;
};

const TaskNodeContext =
  createRequiredContext<TaskNodeContextType>("TaskNodeProvider");

export const TaskNodeProvider = ({
  children,
  data,
  selected,
  status,
}: TaskNodeProviderProps) => {
  const notify = useToastNotification();
  const reactFlowInstance = useReactFlow();

  const taskSpec = data.taskSpec;
  const taskId = data.taskId;
  const nodeId = taskId ? taskIdToNodeId(taskId) : "";

  const componentRef = taskSpec?.componentRef || {};
  const inputs = componentRef.spec?.inputs || [];
  const outputs = componentRef.spec?.outputs || [];

  const name = getComponentName(componentRef);

  const isCustomComponent = !componentRef.url; // Custom components don't have a source url

  const { componentRef: mostRecentComponentRef } = useComponentFromUrl(
    componentRef.url,
  );

  const isOutdated = componentRef.digest !== mostRecentComponentRef.digest;

  const dimensions = useTaskNodeDimensions(taskSpec);

  const handleSetArguments = useCallback(
    (args: Record<string, ArgumentType>) => {
      data.callbacks?.setArguments(args);
    },
    [data.callbacks],
  );

  const handleSetAnnotations = useCallback(
    (annotations: Annotations) => {
      data.callbacks?.setAnnotations(annotations);
    },
    [data.callbacks],
  );

  const handleSetCacheStaleness = useCallback(
    (cacheStaleness: string | undefined) => {
      data.callbacks?.setCacheStaleness(cacheStaleness);
    },
    [data.callbacks],
  );

  const handleDeleteTaskNode = useCallback(() => {
    data.callbacks?.onDelete();
  }, [data.callbacks]);

  const handleDuplicateTaskNode = useCallback(() => {
    data.callbacks?.onDuplicate();
  }, [data.callbacks]);

  const handleUpgradeTaskNode = useCallback(() => {
    if (!isOutdated) {
      notify("Component version already matches source URL", "info");
      return;
    }

    data.callbacks?.onUpgrade(mostRecentComponentRef);
  }, [data.callbacks, isOutdated, mostRecentComponentRef, notify]);

  const select = useCallback(() => {
    reactFlowInstance.setNodes((nodes) =>
      nodes.map((node) =>
        node.id === nodeId ? { ...node, selected: true } : node,
      ),
    );
  }, [nodeId, reactFlowInstance]);

  const state = useMemo(
    (): TaskNodeState => ({
      selected: selected && !data.isGhost,
      highlighted: !!data.highlighted && !data.isGhost,
      readOnly: !!data.readOnly || !!data.isGhost,
      connectable: !!data.connectable,
      status: data.isGhost ? undefined : status,
      disabled: data.isGhost ?? false,
      isCustomComponent,
      dimensions,
    }),
    [
      selected,
      data.highlighted,
      data.readOnly,
      data.isGhost,
      status,
      isCustomComponent,
      dimensions,
    ],
  );

  const callbacks = useMemo(
    () => ({
      setArguments: handleSetArguments,
      setAnnotations: handleSetAnnotations,
      setCacheStaleness: handleSetCacheStaleness,
      onDelete: handleDeleteTaskNode,
      onDuplicate: handleDuplicateTaskNode,
      onUpgrade: handleUpgradeTaskNode,
    }),
    [
      handleSetArguments,
      handleSetAnnotations,
      handleDeleteTaskNode,
      handleDuplicateTaskNode,
      handleUpgradeTaskNode,
    ],
  );

  const value = useMemo(
    () => ({
      taskSpec,
      taskId,
      nodeId,
      inputs,
      outputs,
      name,
      state,
      callbacks,
      select,
    }),
    [taskSpec, taskId, nodeId, inputs, outputs, name, state, callbacks, select],
  );

  return (
    <TaskNodeContext.Provider value={value}>
      {children}
    </TaskNodeContext.Provider>
  );
};

export function useTaskNode() {
  return useRequiredContext(TaskNodeContext);
}
