import type { Edge, Node, XYPosition } from "@xyflow/react";

import type {
  ComponentSpec,
  Input,
  Output,
  Task,
} from "@/models/componentSpec";

const TASK_OFFSET = 200;
const IO_OFFSET = 150;

function resolvePosition(
  position: { x: number; y: number },
  fallback: { x: number; y: number },
): { x: number; y: number } {
  return position.x === 0 && position.y === 0 ? fallback : position;
}

export function ioDefaultPosition(
  index: number,
  x: number,
): { x: number; y: number } {
  return { x, y: index * IO_OFFSET };
}

export function taskDefaultPosition(index: number): { x: number; y: number } {
  return {
    x: 200 + (index % 3) * TASK_OFFSET,
    y: Math.floor(index / 3) * TASK_OFFSET,
  };
}

export function createEntityNode(
  entity: {
    $id: string;
    annotations: { get(key: string): { x: number; y: number } };
  },
  nodeType: string,
  fallback: { x: number; y: number },
  data: Record<string, unknown>,
): Node {
  const position = entity.annotations.get("editor.position");
  return {
    id: entity.$id,
    type: nodeType,
    position: resolvePosition(position, fallback),
    data,
  };
}

export function buildEntityPositionMap(
  inputs: Input[],
  outputs: Output[],
  tasks: Task[],
): Map<string, XYPosition> {
  const map = new Map<string, XYPosition>();
  for (const [index, input] of inputs.entries()) {
    const pos = input.annotations.get("editor.position");
    map.set(input.$id, resolvePosition(pos, ioDefaultPosition(index, -200)));
  }
  for (const [index, output] of outputs.entries()) {
    const pos = output.annotations.get("editor.position");
    map.set(output.$id, resolvePosition(pos, ioDefaultPosition(index, 800)));
  }
  for (const [index, task] of tasks.entries()) {
    const pos = task.annotations.get("editor.position");
    map.set(task.$id, resolvePosition(pos, taskDefaultPosition(index)));
  }
  return map;
}

export function buildBindingEdges(spec: ComponentSpec): Edge[] {
  const inputIds = new Set([...spec.inputs].map((input) => input.$id));
  const outputIds = new Set([...spec.outputs].map((output) => output.$id));

  return [...spec.bindings].map((binding) => {
    const isSourceIO = inputIds.has(binding.sourceEntityId);
    const isTargetIO = outputIds.has(binding.targetEntityId);

    return {
      id: `edge_${binding.$id}`,
      source: binding.sourceEntityId,
      sourceHandle: isSourceIO
        ? `output_${binding.sourceEntityId}`
        : `output_${binding.sourcePortName}`,
      target: binding.targetEntityId,
      targetHandle: isTargetIO
        ? `input_${binding.targetEntityId}`
        : `input_${binding.targetPortName}`,
      type: "default",
    };
  });
}
