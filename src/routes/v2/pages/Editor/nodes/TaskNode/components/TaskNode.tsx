import { type Node, type NodeProps, useStore } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import type {
  ComponentSpec,
  ComponentSpecJson,
  Task,
  TypeSpecType,
} from "@/models/componentSpec";
import { ZOOM_THRESHOLD } from "@/routes/v2/shared/flowCanvasDefaults";
import type { TaskNodeData } from "@/routes/v2/shared/nodes/types";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import {
  editorStore,
  selectNode,
  setFocusedArgument,
} from "@/routes/v2/shared/store/editorStore";

import { TaskNodeClassic } from "./TaskNodeClassic";
import { TaskNodeCollapsed } from "./TaskNodeCollapsed";
import { TaskNodeFull } from "./TaskNodeFull";

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

export const TaskNode = observer(function TaskNode({
  id,
  data,
  selected,
}: TaskNodeProps) {
  const { entityId } = data;
  const showContent = useStore(zoomSelector);
  const useClassicStyle = useFlagValue("classic-node-style");

  const spec = useSpec();
  const task = spec?.tasks.find((t) => t.$id === entityId);

  const handleClick = (event: React.MouseEvent) => {
    selectNode(id, "task", {
      shiftKey: event.shiftKey,
      entityId,
    });
  };

  if (!task) {
    return (
      <Card className="min-w-[180px] max-w-[280px] rounded-xl border-2 border-red-300 p-4">
        <Text size="sm" tone="subdued">
          Task not found: {entityId}
        </Text>
      </Card>
    );
  }

  const componentSpec = task.componentRef.spec as ComponentSpecJson | undefined;
  const inputs = componentSpec?.inputs ?? [];
  const outputs = componentSpec?.outputs ?? [];
  const description = componentSpec?.description ?? "";

  const isSubgraph = isTaskSubgraph(componentSpec);
  const taskName = task.name;
  const isHovered = editorStore.hoveredEntityId === entityId;

  const handleInputClick = (inputName: string) => {
    selectNode(id, "task", { entityId });
    setFocusedArgument(inputName);
  };

  const inputDisplayValues = useClassicStyle
    ? resolveInputDisplayValues(task, entityId, spec)
    : {};

  const rawColor = task.annotations.get("tangleml.com/editor/task-color");
  const taskColor =
    rawColor && rawColor !== "transparent" ? rawColor : undefined;

  const viewProps: TaskNodeViewProps = {
    id,
    entityId,
    taskName,
    selected: !!selected,
    isHovered,
    isSubgraph,
    description,
    inputs,
    outputs,
    annotations: task.annotations.map((a) => ({ key: a.key })),
    taskColor,
    inputDisplayValues,
    onNodeClick: handleClick,
    onInputClick: handleInputClick,
  };

  if (!showContent) {
    return <TaskNodeCollapsed {...viewProps} />;
  }

  return useClassicStyle ? (
    <TaskNodeClassic {...viewProps} />
  ) : (
    <TaskNodeFull {...viewProps} />
  );
});
