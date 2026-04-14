import type { Edge, Node } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";

const TASK_OFFSET = 200;
const IO_OFFSET = 150;

export function resolvePosition(
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

function parseZIndex(raw: unknown): number | undefined {
  if (typeof raw === "number") return Math.round(raw);
  if (typeof raw === "string") {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) return Math.round(parsed);
  }
  return undefined;
}

export function createEntityNode(
  entity: {
    $id: string;
    annotations: { get(key: string): unknown };
  },
  nodeType: string,
  fallback: { x: number; y: number },
  data: Record<string, unknown>,
): Node {
  const position = entity.annotations.get("editor.position") as {
    x: number;
    y: number;
  };
  const zIndex = parseZIndex(entity.annotations.get("zIndex"));
  return {
    id: entity.$id,
    type: nodeType,
    position: resolvePosition(position, fallback),
    zIndex,
    data,
  };
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
      type: "conduitEdge",
      style: { stroke: "#6b7280", strokeWidth: 4 },
    };
  });
}
