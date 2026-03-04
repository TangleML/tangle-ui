import { type Node, type NodeProps, useStore } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import type { ComponentSpecJson, TypeSpecType } from "@/models/componentSpec";

import type { TaskNodeData } from "../hooks/useSpecToNodesEdges";
import { useSpec } from "../providers/SpecContext";
import {
  editorStore,
  selectNode,
  setFocusedArgument,
} from "../store/editorStore";
import { TaskNodeCollapsed } from "./TaskNodeCollapsed";
import { TaskNodeFull } from "./TaskNodeFull";

type TaskNodeType = Node<TaskNodeData, "task">;
type TaskNodeProps = NodeProps<TaskNodeType>;

export interface TaskNodeViewProps {
  id: string;
  entityId: string;
  taskName: string;
  selected: boolean;
  isHovered: boolean;
  isSubgraph: boolean;
  description: string;
  inputs: { name: string; type?: TypeSpecType; optional?: boolean }[];
  outputs: { name: string; type?: TypeSpecType }[];
  annotations: { key: string }[];
  onNodeClick: (event: React.MouseEvent) => void;
  onInputClick: (inputName: string, event: React.MouseEvent) => void;
}

export const ZOOM_THRESHOLD = 0.5;

const zoomSelector = (s: { transform: [number, number, number] }) =>
  s.transform[2] >= ZOOM_THRESHOLD;

/**
 * Check if a task is a subgraph (its component has a graph implementation).
 */
function isTaskSubgraph(componentSpec: ComponentSpecJson | undefined): boolean {
  const implementation = componentSpec?.implementation;
  if (!implementation || typeof implementation !== "object") {
    return false;
  }
  return "graph" in implementation;
}

export const TaskNode = observer(function TaskNode({
  id,
  data,
  selected,
}: TaskNodeProps) {
  const { entityId } = data;
  const showContent = useStore(zoomSelector);

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
    onNodeClick: handleClick,
    onInputClick: handleInputClick,
  };

  return showContent ? (
    <TaskNodeFull {...viewProps} />
  ) : (
    <TaskNodeCollapsed {...viewProps} />
  );
});
