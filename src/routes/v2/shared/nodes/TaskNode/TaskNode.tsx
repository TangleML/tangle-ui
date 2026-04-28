import {
  type Node,
  type NodeProps,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { observer } from "mobx-react-lite";
import type { MouseEvent, ReactElement } from "react";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type {
  ComponentSpec,
  ComponentSpecJson,
  Task,
  TypeSpecType,
} from "@/models/componentSpec";
import { ZOOM_THRESHOLD } from "@/routes/v2/shared/flowCanvasDefaults";
import type { TaskNodeData } from "@/routes/v2/shared/nodes/types";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import type { NodeOverlayEffect } from "@/routes/v2/shared/store/canvasOverlay.types";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { EDITOR_COLLAPSED_ANNOTATION } from "@/utils/annotations";
import { ISO8601_DURATION_ZERO_DAYS } from "@/utils/constants";

import { TaskNodeCard } from "./TaskNodeCard";
import { TaskNodeSimplified } from "./TaskNodeSimplified";

type TaskNodeType = Node<TaskNodeData, "task">;
type TaskNodeProps = NodeProps<TaskNodeType>;

export interface TaskNodeInput {
  name: string;
  type?: TypeSpecType;
  optional?: boolean;
  default?: string;
}

export interface TaskNodeOutput {
  name: string;
  type?: TypeSpecType;
}

export interface TaskNodeViewProps {
  id: string;
  entityId: string;
  taskName: string;
  selected: boolean;
  isHovered: boolean;
  isSubgraph: boolean;
  collapsed: boolean;
  description: string;
  inputs: TaskNodeInput[];
  outputs: TaskNodeOutput[];
  connectedInputNames: Set<string>;
  connectedOutputNames: Set<string>;
  annotations: { key: string }[];
  taskColor?: string;
  cacheDisabled: boolean;
  digest?: string;
  inputDisplayValues: Record<string, string | undefined>;
  onNodeClick: (event: React.MouseEvent) => void;
  onInputClick: (inputName: string, event: React.MouseEvent) => void;
  onOutputClick: (outputName: string, event: React.MouseEvent) => void;
  onHandleClick: (handleId: string, event: React.MouseEvent) => void;
}

const zoomSelector = (s: { transform: [number, number, number] }) =>
  s.transform[2] >= ZOOM_THRESHOLD;

function isTaskSubgraph(componentSpec: ComponentSpecJson | undefined): boolean {
  const implementation = componentSpec?.implementation;
  if (!implementation || typeof implementation !== "object") {
    return false;
  }
  return "graph" in implementation;
}

/**
 * Resolve display values for task inputs by merging literal argument values
 * with binding-derived connection labels.
 */
function resolveInputDisplayValues(
  task: Task,
  entityId: string,
  spec: ComponentSpec | null,
): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {};

  for (const arg of task.arguments) {
    if (typeof arg.value === "string") {
      values[arg.name] = arg.value;
    }
  }

  if (!spec) return values;

  for (const binding of spec.bindings) {
    if (binding.targetEntityId !== entityId) continue;

    const sourceTask = spec.tasks.find((t) => t.$id === binding.sourceEntityId);
    if (sourceTask) {
      values[binding.targetPortName] =
        `→ ${sourceTask.name}.${binding.sourcePortName}`;
      continue;
    }

    const sourceInput = spec.inputs.find(
      (i) => i.$id === binding.sourceEntityId,
    );
    if (sourceInput) {
      values[binding.targetPortName] = `→ ${sourceInput.name}`;
    }
  }

  return values;
}

function resolveConnectedPortNames(
  entityId: string,
  spec: ComponentSpec | null,
): { inputs: Set<string>; outputs: Set<string> } {
  const inputs = new Set<string>();
  const outputs = new Set<string>();

  if (!spec) return { inputs, outputs };

  for (const binding of spec.bindings) {
    if (binding.targetEntityId === entityId) {
      inputs.add(binding.targetPortName);
    }
    if (binding.sourceEntityId === entityId) {
      outputs.add(binding.sourcePortName);
    }
  }

  return { inputs, outputs };
}

function resolveTaskColor(task: Task): string | undefined {
  const rawColor = task.annotations.get("tangleml.com/editor/task-color");
  return rawColor && rawColor !== "transparent" ? rawColor : undefined;
}

function getComponentSpecDefaults(spec: ComponentSpecJson | undefined) {
  return {
    description: spec?.description ?? "",
    inputs: spec?.inputs ?? [],
    outputs: spec?.outputs ?? [],
  };
}

function resolveNodeEffect(
  canvasOverlay: {
    activeOverlay: {
      resolveNodeEffect?: (id: string) => NodeOverlayEffect | undefined;
    } | null;
  },
  entityId: string,
): NodeOverlayEffect | undefined {
  return canvasOverlay.activeOverlay?.resolveNodeEffect?.(entityId);
}

function NodeEffectWrapper({
  effect,
  children,
}: {
  effect: NodeOverlayEffect | undefined;
  children: ReactElement;
}) {
  if (!effect?.className && effect?.opacity === undefined) {
    return children;
  }
  return (
    <div
      className={cn(effect?.className)}
      style={
        effect?.opacity !== undefined ? { opacity: effect.opacity } : undefined
      }
    >
      {children}
    </div>
  );
}

function TaskNodeNotFound({ entityId }: { entityId: string }) {
  return (
    <Card className="min-w-45 max-w-70 rounded-xl border-2 border-red-300 p-4">
      <Text size="sm" tone="subdued">
        Task not found: {entityId}
      </Text>
    </Card>
  );
}

export const TaskNode = observer(function TaskNode({
  id,
  data,
  selected,
}: TaskNodeProps) {
  const { entityId } = data;
  const { editor, canvasOverlay } = useSharedStores();
  const { getEdges, setEdges } = useReactFlow();
  const showContent = useStore(zoomSelector);

  const spec = useSpec();
  const task = spec?.tasks.find((t) => t.$id === entityId);
  const nodeEffect = resolveNodeEffect(canvasOverlay, entityId);

  if (!task) return <TaskNodeNotFound entityId={entityId} />;
  if (nodeEffect?.hidden) return null;

  const componentSpec = task.resolvedComponentSpec;
  const { description, inputs, outputs } =
    getComponentSpecDefaults(componentSpec);
  const isManuallyCollapsed =
    task.annotations.get(EDITOR_COLLAPSED_ANNOTATION) === "true";

  const handleClick = (event: MouseEvent) => {
    editor.selectNode(id, "task", { shiftKey: event.shiftKey, entityId });
  };

  const selectEdgesByHandle = (handleId: string) => {
    setEdges(
      getEdges().map((edge) => ({
        ...edge,
        selected:
          (edge.target === id && edge.targetHandle === handleId) ||
          (edge.source === id && edge.sourceHandle === handleId),
      })),
    );
  };

  const handleInputClick = (inputName: string, e: MouseEvent) => {
    e.stopPropagation();
    editor.selectNode(id, "task", { entityId });
    editor.setFocusedArgument(inputName);
  };

  const handleOutputClick = (_outputName: string, e: MouseEvent) => {
    e.stopPropagation();
    editor.selectNode(id, "task", { entityId });
  };

  const handleHandleClick = (handleId: string, e: MouseEvent) => {
    e.stopPropagation();
    selectEdgesByHandle(handleId);
  };

  const connectedPorts = resolveConnectedPortNames(entityId, spec);

  const viewProps: TaskNodeViewProps = {
    id,
    entityId,
    taskName: task.name,
    selected: !!selected,
    isHovered: editor.hoveredEntityId === entityId,
    isSubgraph: isTaskSubgraph(componentSpec),
    collapsed: isManuallyCollapsed,
    description,
    inputs,
    outputs,
    connectedInputNames: connectedPorts.inputs,
    connectedOutputNames: connectedPorts.outputs,
    annotations: task.annotations.map((a) => ({ key: a.key })),
    taskColor: resolveTaskColor(task),
    cacheDisabled:
      task.executionOptions?.cachingStrategy?.maxCacheStaleness ===
      ISO8601_DURATION_ZERO_DAYS,
    digest: task.componentRef.digest,
    inputDisplayValues: resolveInputDisplayValues(task, entityId, spec),
    onNodeClick: handleClick,
    onInputClick: handleInputClick,
    onOutputClick: handleOutputClick,
    onHandleClick: handleHandleClick,
  };

  const OverrideComponent = nodeEffect?.componentOverride;
  if (OverrideComponent) {
    return (
      <NodeEffectWrapper effect={nodeEffect}>
        <OverrideComponent {...viewProps} />
      </NodeEffectWrapper>
    );
  }

  if (!showContent) {
    return (
      <NodeEffectWrapper effect={nodeEffect}>
        <TaskNodeSimplified {...viewProps} />
      </NodeEffectWrapper>
    );
  }

  return (
    <NodeEffectWrapper effect={nodeEffect}>
      <TaskNodeCard {...viewProps} />
    </NodeEffectWrapper>
  );
});
