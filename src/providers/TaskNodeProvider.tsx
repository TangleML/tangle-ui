import { useReactFlow } from "@xyflow/react";
import { type ReactNode } from "react";

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
  runStatus?: ContainerExecutionStatus;
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
  runStatus?: ContainerExecutionStatus;
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
  runStatus,
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

  const handleSetArguments = (args: Record<string, ArgumentType>) => {
    data.callbacks?.setArguments(args);
  };

  const handleSetAnnotations = (annotations: Annotations) => {
    data.callbacks?.setAnnotations(annotations);
  };

  const handleSetCacheStaleness = (cacheStaleness: string | undefined) => {
    data.callbacks?.setCacheStaleness(cacheStaleness);
  };

  const handleDeleteTaskNode = () => {
    data.callbacks?.onDelete();
  };

  const handleDuplicateTaskNode = () => {
    data.callbacks?.onDuplicate();
  };

  const handleUpgradeTaskNode = () => {
    if (!isOutdated) {
      notify("Component version already matches source URL", "info");
      return;
    }

    data.callbacks?.onUpgrade(mostRecentComponentRef);
  };

  const select = () => {
    reactFlowInstance.setNodes((nodes) =>
      nodes.map((node) =>
        node.id === nodeId ? { ...node, selected: true } : node,
      ),
    );
  };

  const state: TaskNodeState = {
    selected: selected && !data.isGhost,
    highlighted: !!data.highlighted && !data.isGhost,
    readOnly: !!data.readOnly || !!data.isGhost,
    connectable: !!data.connectable,
    runStatus: data.isGhost ? undefined : runStatus,
    disabled: data.isGhost ?? false,
    isCustomComponent,
    dimensions,
  };

  const callbacks = {
    setArguments: handleSetArguments,
    setAnnotations: handleSetAnnotations,
    setCacheStaleness: handleSetCacheStaleness,
    onDelete: handleDeleteTaskNode,
    onDuplicate: handleDuplicateTaskNode,
    onUpgrade: handleUpgradeTaskNode,
  };

  const value = {
    taskSpec,
    taskId,
    nodeId,
    inputs,
    outputs,
    name,
    state,
    callbacks,
    select,
  };

  return (
    <TaskNodeContext.Provider value={value}>
      {children}
    </TaskNodeContext.Provider>
  );
};

export function useTaskNode() {
  return useRequiredContext(TaskNodeContext);
}
