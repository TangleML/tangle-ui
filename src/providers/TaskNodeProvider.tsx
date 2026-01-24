import { useReactFlow } from "@xyflow/react";
import { type ReactNode, useCallback, useMemo } from "react";

import useComponentFromUrl from "@/hooks/useComponentFromUrl";
import { useTaskNodeDimensions } from "@/hooks/useTaskNodeDimensions";
import useToastNotification from "@/hooks/useToastNotification";
import type { Annotations } from "@/types/annotations";
import {
  DEFAULT_TASK_NODE_CALLBACKS,
  type TaskNodeData,
  type TaskNodeDimensions,
} from "@/types/taskNode";
import type {
  ArgumentType,
  ComponentReference,
  InputSpec,
  OutputSpec,
  TaskSpec,
} from "@/utils/componentSpec";
import { getComponentName, getTaskDisplayName } from "@/utils/getComponentName";
import { taskIdToNodeId } from "@/utils/nodes/nodeIdUtils";

import {
  createRequiredContext,
  useRequiredContext,
} from "../hooks/useRequiredContext";

const EMPTY_COMPONENT_REF: Partial<ComponentReference> = {};
const EMPTY_INPUTS: InputSpec[] = [];
const EMPTY_OUTPUTS: OutputSpec[] = [];

type TaskNodeState = Readonly<{
  selected: boolean;
  highlighted: boolean;
  readOnly: boolean;
  disabled: boolean;
  connectable: boolean;
  status?: string;
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
  status?: string;
};

export type TaskNodeContextType = {
  taskSpec?: TaskSpec;
  taskId?: string;
  nodeId: string;
  inputs: InputSpec[];
  outputs: OutputSpec[];
  name: string;
  displayName: string;
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

  const {
    onDelete,
    onDuplicate,
    onUpgrade,
    setArguments,
    setAnnotations,
    setCacheStaleness,
  } = data.callbacks ?? DEFAULT_TASK_NODE_CALLBACKS;

  const componentRef = taskSpec?.componentRef ?? EMPTY_COMPONENT_REF;
  const inputs = componentRef.spec?.inputs ?? EMPTY_INPUTS;
  const outputs = componentRef.spec?.outputs ?? EMPTY_OUTPUTS;

  const name = getComponentName(componentRef);
  const displayName = getTaskDisplayName(taskId ?? "Task", taskSpec);

  const isCustomComponent = !componentRef.url; // Custom components don't have a source url

  const { componentRef: mostRecentComponentRef } = useComponentFromUrl(
    componentRef.url,
  );

  const isOutdated = componentRef.digest !== mostRecentComponentRef.digest;

  const dimensions = useTaskNodeDimensions(taskSpec);

  const handleSetArguments = useCallback(
    (args: Record<string, ArgumentType>) => {
      setArguments(args);
    },
    [setArguments],
  );

  const handleSetAnnotations = useCallback(
    (annotations: Annotations) => {
      setAnnotations(annotations);
    },
    [setAnnotations],
  );

  const handleSetCacheStaleness = useCallback(
    (cacheStaleness: string | undefined) => {
      setCacheStaleness(cacheStaleness);
    },
    [setCacheStaleness, notify],
  );

  const handleDeleteTaskNode = useCallback(() => {
    onDelete();
  }, [onDelete]);

  const handleDuplicateTaskNode = useCallback(() => {
    onDuplicate();
  }, [onDuplicate]);

  const handleUpgradeTaskNode = useCallback(() => {
    if (!isOutdated) {
      notify("Component version already matches source URL", "info");
      return;
    }

    onUpgrade(mostRecentComponentRef);
  }, [onUpgrade, isOutdated, mostRecentComponentRef, notify]);

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
      displayName,
      state,
      callbacks,
      select,
    }),
    [
      taskSpec,
      taskId,
      nodeId,
      inputs,
      outputs,
      name,
      displayName,
      state,
      callbacks,
      select,
    ],
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
