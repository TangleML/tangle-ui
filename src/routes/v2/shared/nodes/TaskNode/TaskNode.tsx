import { type Node, type NodeProps, useStore } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import type { ReactElement } from "react";

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

import { TaskNodeClassic } from "./TaskNodeClassic";
import { TaskNodeCollapsed } from "./TaskNodeCollapsed";

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
  description: string;
  inputs: TaskNodeInput[];
  outputs: TaskNodeOutput[];
  annotations: { key: string }[];
  taskColor?: string;
  inputDisplayValues: Record<string, string | undefined>;
  onNodeClick: (event: React.MouseEvent) => void;
  onInputClick: (inputName: string, event: React.MouseEvent) => void;
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
    <Card className="min-w-[180px] max-w-[280px] rounded-xl border-2 border-red-300 p-4">
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
  const showContent = useStore(zoomSelector);

  const spec = useSpec();
  const task = spec?.tasks.find((t) => t.$id === entityId);
  const nodeEffect = resolveNodeEffect(canvasOverlay, entityId);

  if (!task) return <TaskNodeNotFound entityId={entityId} />;
  if (nodeEffect?.hidden) return null;

  const componentSpec = task.componentRef.spec;
  const { description, inputs, outputs } =
    getComponentSpecDefaults(componentSpec);

  const handleClick = (event: React.MouseEvent) => {
    editor.selectNode(id, "task", { shiftKey: event.shiftKey, entityId });
  };

  const handleInputClick = (inputName: string) => {
    editor.selectNode(id, "task", { entityId });
    editor.setFocusedArgument(inputName);
  };

  const viewProps: TaskNodeViewProps = {
    id,
    entityId,
    taskName: task.name,
    selected: !!selected,
    isHovered: editor.hoveredEntityId === entityId,
    isSubgraph: isTaskSubgraph(componentSpec),
    description,
    inputs,
    outputs,
    annotations: task.annotations.map((a) => ({ key: a.key })),
    taskColor: resolveTaskColor(task),
    inputDisplayValues: resolveInputDisplayValues(task, entityId, spec),
    onNodeClick: handleClick,
    onInputClick: handleInputClick,
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
        <TaskNodeCollapsed {...viewProps} />
      </NodeEffectWrapper>
    );
  }

  return (
    <NodeEffectWrapper effect={nodeEffect}>
      <TaskNodeClassic {...viewProps} />
    </NodeEffectWrapper>
  );
});
