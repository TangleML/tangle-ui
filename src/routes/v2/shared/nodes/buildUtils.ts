import type { Edge, Node, XYPosition } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import {
  EDITOR_POSITION_ANNOTATION,
  ZINDEX_ANNOTATION,
} from "@/utils/annotations";

const TASK_OFFSET = 200;
const IO_OFFSET = 150;
const INPUT_COLUMN_X = -200;
const OUTPUT_COLUMN_X = 800;

interface PositionedEntity {
  annotations: {
    has(key: string): boolean;
    get(key: string): unknown;
  };
}

function resolvePosition(
  entity: PositionedEntity,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  if (!entity.annotations.has(EDITOR_POSITION_ANNOTATION)) return fallback;
  return entity.annotations.get(EDITOR_POSITION_ANNOTATION) as XYPosition;
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

/**
 * Reading the position annotation directly is not equivalent: the codec returns
 * `{x:0,y:0}` for an entity that was never placed, where the canvas draws it on
 * an index-based default.
 */
export function resolveEntityPositions(
  spec: ComponentSpec,
): Map<string, XYPosition> {
  const positions = new Map<string, XYPosition>();
  for (const [index, input] of [...spec.inputs].entries()) {
    positions.set(
      input.$id,
      resolvePosition(input, ioDefaultPosition(index, INPUT_COLUMN_X)),
    );
  }
  for (const [index, output] of [...spec.outputs].entries()) {
    positions.set(
      output.$id,
      resolvePosition(output, ioDefaultPosition(index, OUTPUT_COLUMN_X)),
    );
  }
  for (const [index, task] of [...spec.tasks].entries()) {
    positions.set(task.$id, resolvePosition(task, taskDefaultPosition(index)));
  }
  return positions;
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
  entity: PositionedEntity & { $id: string },
  nodeType: string,
  fallback: { x: number; y: number },
  data: Record<string, unknown>,
  domAttributes?: Record<string, string>,
): Node {
  const zIndex = parseZIndex(entity.annotations.get(ZINDEX_ANNOTATION));
  return {
    id: entity.$id,
    type: nodeType,
    position: resolvePosition(entity, fallback),
    zIndex,
    data,
    domAttributes,
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
