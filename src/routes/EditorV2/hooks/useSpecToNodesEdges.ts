import type { Edge, Node } from "@xyflow/react";
import { useRef } from "react";

import type {
  Binding,
  ComponentSpec,
  Input,
  Output,
  Task,
} from "@/models/componentSpec";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

interface NodePosition {
  x: number;
  y: number;
}

const DEFAULT_POSITION: NodePosition = { x: 0, y: 0 };
const TASK_OFFSET = 200;
const IO_OFFSET = 150;

function getPositionFromAnnotations(
  annotations: { key: string; value: unknown }[],
): NodePosition {
  const posAnnotation = annotations.find(
    (a) => a.key === EDITOR_POSITION_ANNOTATION,
  );
  if (!posAnnotation?.value) {
    return DEFAULT_POSITION;
  }

  try {
    const posStr = posAnnotation.value;
    if (typeof posStr === "string") {
      return JSON.parse(posStr) as NodePosition;
    }
  } catch {
    // Ignore parse errors
  }

  return DEFAULT_POSITION;
}

export interface TaskNodeData extends Record<string, unknown> {
  entityId: string;
  name: string;
}

export interface IONodeData extends Record<string, unknown> {
  entityId: string;
  ioType: "input" | "output";
  name: string;
}

const EMPTY_RESULT: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] };

/**
 * Build a fingerprint string that changes only when the meaningful data changes.
 * This prevents creating new node/edge array references on every render.
 */
function buildFingerprint(spec: ComponentSpec): string {
  const parts: string[] = [];

  for (const input of spec.inputs) {
    const pos = input.annotations.find(
      (a) => a.key === EDITOR_POSITION_ANNOTATION,
    )?.value;
    parts.push(`i:${input.$id}:${input.name}:${pos ?? ""}`);
  }

  for (const output of spec.outputs) {
    const pos = output.annotations.find(
      (a) => a.key === EDITOR_POSITION_ANNOTATION,
    )?.value;
    parts.push(`o:${output.$id}:${output.name}:${pos ?? ""}`);
  }

  for (const task of spec.tasks) {
    const pos = task.annotations.find(
      (a) => a.key === EDITOR_POSITION_ANNOTATION,
    )?.value;
    parts.push(`t:${task.$id}:${task.name}:${pos ?? ""}`);
  }

  for (const binding of spec.bindings) {
    parts.push(
      `b:${binding.$id}:${binding.sourceEntityId}:${binding.sourcePortName}:${binding.targetEntityId}:${binding.targetPortName}`,
    );
  }

  return parts.join("|");
}

function buildNodesAndEdges(
  inputs: Input[],
  outputs: Output[],
  tasks: Task[],
  bindings: Binding[],
): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  inputs.forEach((input, index) => {
    const position = getPositionFromAnnotations(input.annotations);

    nodes.push({
      id: input.$id,
      type: "io",
      position:
        position.x === 0 && position.y === 0
          ? { x: -200, y: index * IO_OFFSET }
          : position,
      data: {
        entityId: input.$id,
        ioType: "input",
        name: input.name,
      } satisfies IONodeData,
    });
  });

  outputs.forEach((output, index) => {
    const position = getPositionFromAnnotations(output.annotations);

    nodes.push({
      id: output.$id,
      type: "io",
      position:
        position.x === 0 && position.y === 0
          ? { x: 800, y: index * IO_OFFSET }
          : position,
      data: {
        entityId: output.$id,
        ioType: "output",
        name: output.name,
      } satisfies IONodeData,
    });
  });

  tasks.forEach((task, index) => {
    const position = getPositionFromAnnotations(task.annotations);

    nodes.push({
      id: task.$id,
      type: "task",
      position:
        position.x === 0 && position.y === 0
          ? {
              x: 200 + (index % 3) * TASK_OFFSET,
              y: Math.floor(index / 3) * TASK_OFFSET,
            }
          : position,
      data: {
        entityId: task.$id,
        name: task.name,
      } satisfies TaskNodeData,
    });
  });

  for (const binding of bindings) {
    const isSourceIO = inputs.some((i) => i.$id === binding.sourceEntityId);
    const isTargetIO = outputs.some((o) => o.$id === binding.targetEntityId);

    const sourceHandle = isSourceIO
      ? `output_${binding.sourceEntityId}`
      : `output_${binding.sourcePortName}`;

    const targetHandle = isTargetIO
      ? `input_${binding.targetEntityId}`
      : `input_${binding.targetPortName}`;

    edges.push({
      id: `edge_${binding.$id}`,
      source: binding.sourceEntityId,
      sourceHandle,
      target: binding.targetEntityId,
      targetHandle,
      type: "default",
    });
  }

  return { nodes, edges };
}

/**
 * Derive ReactFlow nodes and edges from a ComponentSpec.
 *
 * Uses fingerprint-based caching to return stable references when the
 * underlying data hasn't changed, preventing infinite re-render loops
 * with React Flow's controlled state.
 */
export function useSpecToNodesEdges(spec: ComponentSpec | null) {
  const cacheRef = useRef<{
    fingerprint: string;
    result: { nodes: Node[]; edges: Edge[] };
  } | null>(null);

  if (!spec) return EMPTY_RESULT;

  const fingerprint = buildFingerprint(spec);

  if (cacheRef.current && cacheRef.current.fingerprint === fingerprint) {
    return cacheRef.current.result;
  }

  const result = buildNodesAndEdges(
    [...spec.inputs],
    [...spec.outputs],
    [...spec.tasks],
    [...spec.bindings],
  );

  cacheRef.current = { fingerprint, result };
  return result;
}
