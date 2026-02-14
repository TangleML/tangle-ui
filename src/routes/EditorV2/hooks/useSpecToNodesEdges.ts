import type { Edge, Node } from "@xyflow/react";
import { useSnapshot } from "valtio";

import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

import { editorStore } from "../store/editorStore";

interface NodePosition {
  x: number;
  y: number;
}

const DEFAULT_POSITION: NodePosition = { x: 0, y: 0 };
const TASK_OFFSET = 200;
const IO_OFFSET = 150;

/**
 * Parse position from annotations.
 */
function getPositionFromAnnotations(
  annotations?: Record<string, unknown>,
): NodePosition {
  if (!annotations?.[EDITOR_POSITION_ANNOTATION]) {
    return DEFAULT_POSITION;
  }

  try {
    const posStr = annotations[EDITOR_POSITION_ANNOTATION];
    if (typeof posStr === "string") {
      return JSON.parse(posStr) as NodePosition;
    }
  } catch {
    // Ignore parse errors
  }

  return DEFAULT_POSITION;
}

/**
 * Check if spec has a graph implementation.
 * Works with both raw spec and valtio snapshots.
 */
function hasGraphImplementation(
  spec: unknown,
): spec is { implementation: GraphImplementation } {
  if (!spec || typeof spec !== "object") return false;
  const s = spec as { implementation?: unknown };
  return s.implementation instanceof GraphImplementation;
}

/**
 * Node data contains only stable entity $id.
 * Node components fetch actual data from the store using this id.
 */
export interface TaskNodeData extends Record<string, unknown> {
  entityId: string;
}

export interface IONodeData extends Record<string, unknown> {
  entityId: string;
  ioType: "input" | "output";
}

/**
 * Hook to convert ComponentSpec to ReactFlow nodes and edges.
 *
 * Node data only contains stable entity $id references.
 * Node components fetch actual data from the store using these ids,
 * which ensures valtio reactivity works correctly.
 */
export function useSpecToNodesEdges() {
  const snapshot = useSnapshot(editorStore);
  const spec = snapshot.spec;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (!spec) {
    return { nodes, edges };
  }

  // Create nodes for graph inputs - use $id for stable node IDs
  const inputs = spec.inputs.getAll();
  inputs.forEach((input, index) => {
    const position = getPositionFromAnnotations(
      input.annotations?.toJson?.() ?? {},
    );

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
      } satisfies IONodeData,
    });
  });

  // Create nodes for graph outputs - use $id for stable node IDs
  const outputs = spec.outputs.getAll();
  outputs.forEach((output, index) => {
    const position = getPositionFromAnnotations(
      output.annotations?.toJson?.() ?? {},
    );

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
      } satisfies IONodeData,
    });
  });

  // Create nodes for tasks - use $id for stable node IDs
  if (hasGraphImplementation(spec)) {
    const tasks = spec.implementation.tasks.getAll();

    tasks.forEach((task, index) => {
      const position = getPositionFromAnnotations(task.annotations.toJson());

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
        } satisfies TaskNodeData,
      });
    });

    // Create edges from bindings - unified approach
    // Bindings represent all connection types:
    // - graphInput: ComponentSpec Input → Task Input
    // - taskOutput: Task Output → Task Input
    // - outputValue: Task Output → ComponentSpec Output
    const bindings = spec.implementation.bindings.getAll();

    for (const binding of bindings) {
      // For IO entity port names, look up the current entity name (in case it was renamed)
      // Task port names are defined by the component spec and are stable
      let sourcePortName = binding.sourcePortName;
      let targetPortName = binding.targetPortName;

      if (binding.bindingType === "graphInput") {
        // Source is an InputEntity - get its current name
        const inputEntity = spec.inputs.findById(binding.sourceEntityId);
        if (inputEntity) {
          sourcePortName = inputEntity.name;
        }
      } else if (binding.bindingType === "outputValue") {
        // Target is an OutputEntity - get its current name
        const outputEntity = spec.outputs.findById(binding.targetEntityId);
        if (outputEntity) {
          targetPortName = outputEntity.name;
        }
      }

      edges.push({
        id: `edge_${binding.$id}`,
        source: binding.sourceEntityId,
        sourceHandle: `output_${sourcePortName}`,
        target: binding.targetEntityId,
        targetHandle: `input_${targetPortName}`,
        type: "default",
      });
    }
  }

  return { nodes, edges };
}
