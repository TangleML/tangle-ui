import type { Edge, Node } from "@xyflow/react";
import { useRef } from "react";

import type {
  Binding,
  ComponentSpec,
  Input,
  Output,
  Task,
} from "@/models/componentSpec";

const TASK_OFFSET = 200;
const IO_OFFSET = 150;

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

function resolvePosition(
  position: { x: number; y: number },
  fallback: { x: number; y: number },
): { x: number; y: number } {
  return position.x === 0 && position.y === 0 ? fallback : position;
}

function ioDefaultPosition(index: number, x: number): { x: number; y: number } {
  return { x, y: index * IO_OFFSET };
}

function taskDefaultPosition(index: number): { x: number; y: number } {
  return {
    x: 200 + (index % 3) * TASK_OFFSET,
    y: Math.floor(index / 3) * TASK_OFFSET,
  };
}

function createEntityNode(
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

/**
 * Build a fingerprint string that changes only when the meaningful data changes.
 * This prevents creating new node/edge array references on every render.
 */
function buildFingerprint(spec: ComponentSpec): string {
  const parts: string[] = [];

  for (const input of spec.inputs) {
    const pos = input.annotations.get("editor.position");
    parts.push(`i:${input.$id}:${input.name}:${pos.x},${pos.y}`);
  }

  for (const output of spec.outputs) {
    const pos = output.annotations.get("editor.position");
    parts.push(`o:${output.$id}:${output.name}:${pos.x},${pos.y}`);
  }

  for (const task of spec.tasks) {
    const pos = task.annotations.get("editor.position");
    parts.push(`t:${task.$id}:${task.name}:${pos.x},${pos.y}`);
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

  for (const [index, input] of inputs.entries()) {
    nodes.push(
      createEntityNode(input, "io", ioDefaultPosition(index, -200), {
        entityId: input.$id,
        ioType: "input",
        name: input.name,
      } satisfies IONodeData),
    );
  }

  for (const [index, output] of outputs.entries()) {
    nodes.push(
      createEntityNode(output, "io", ioDefaultPosition(index, 800), {
        entityId: output.$id,
        ioType: "output",
        name: output.name,
      } satisfies IONodeData),
    );
  }

  for (const [index, task] of tasks.entries()) {
    nodes.push(
      createEntityNode(task, "task", taskDefaultPosition(index), {
        entityId: task.$id,
        name: task.name,
      } satisfies TaskNodeData),
    );
  }

  const indputIds = new Set(inputs.map((i) => i.$id));
  const outputIds = new Set(outputs.map((o) => o.$id));

  for (const binding of bindings) {
    const isSourceIO = indputIds.has(binding.sourceEntityId);
    const isTargetIO = outputIds.has(binding.targetEntityId);

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
