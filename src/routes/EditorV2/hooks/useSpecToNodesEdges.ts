import type { Edge, Node } from "@xyflow/react";

import type {
  Binding,
  ComponentSpec,
  Input,
  Output,
  Task,
} from "@/models/componentSpec";
import { useObservableArray } from "@/models/componentSpec/hooks/useObservableArray";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

interface NodePosition {
  x: number;
  y: number;
}

const DEFAULT_POSITION: NodePosition = { x: 0, y: 0 };
const TASK_OFFSET = 200;
const IO_OFFSET = 150;

/**
 * Parse position from annotations array.
 */
function getPositionFromAnnotations(
  annotations: readonly { key: string; value: unknown }[],
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

/**
 * Node data for task nodes.
 * Contains entity $id and name for display/reactivity.
 */
export interface TaskNodeData extends Record<string, unknown> {
  entityId: string;
  name: string;
}

/**
 * Node data for IO nodes (inputs/outputs).
 * Contains entity $id, type, and name for display/handle IDs.
 */
export interface IONodeData extends Record<string, unknown> {
  entityId: string;
  ioType: "input" | "output";
  name: string;
}

/** Empty result for when spec is null */
const EMPTY_RESULT: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] };

/**
 * Build nodes and edges from a spec.
 */
function buildNodesAndEdges(
  inputs: readonly Input[],
  outputs: readonly Output[],
  tasks: readonly Task[],
  bindings: readonly Binding[],
): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Create nodes for graph inputs - use $id for stable node IDs
  inputs.forEach((input, index) => {
    const position = getPositionFromAnnotations(input.annotations.all);

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

  // Create nodes for graph outputs - use $id for stable node IDs
  outputs.forEach((output, index) => {
    const position = getPositionFromAnnotations(output.annotations.all);

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

  // Create nodes for tasks - use $id for stable node IDs
  tasks.forEach((task, index) => {
    const position = getPositionFromAnnotations(task.annotations.all);

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

  // Create edges from bindings

  for (const binding of bindings) {
    // IO nodes use entityId for handle IDs (stable across renames)
    // Task nodes use port names (defined by component spec, stable)
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
 * Convert a ComponentSpec to ReactFlow nodes and edges.
 *
 * Uses reactive hooks to subscribe to collection changes.
 * Node data contains stable entity $id references - individual nodes
 * use useEntity to subscribe to their own property changes.
 *
 * @param spec - The ComponentSpec to convert
 * @returns Object containing nodes and edges arrays for ReactFlow
 */
export function useSpecToNodesEdges(spec: ComponentSpec | null) {
  const inputs = useObservableArray(spec?.inputs);
  const outputs = useObservableArray(spec?.outputs);
  const tasks = useObservableArray(spec?.tasks);
  const bindings = useObservableArray(spec?.bindings);

  if (!spec) return EMPTY_RESULT;
  return buildNodesAndEdges(inputs, outputs, tasks, bindings);
}
