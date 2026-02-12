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

  // Access version to subscribe to spec changes.
  // Class methods bypass Valtio's proxy, so we use a version counter
  // that gets incremented after mutations to force re-renders.
  void snapshot.version;

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

      // Create edges from task arguments
      const args = task.arguments.getAll();
      for (const arg of args) {
        const argType = arg.type;

        if (argType === "graphInput") {
          // Edge from graph input to task
          const argJson = arg.toJson();
          if (typeof argJson === "object" && "graphInput" in argJson) {
            const sourceInputName = argJson.graphInput.inputName;
            // Find input entity by name to get its $id
            const sourceInput = spec.inputs.findByIndex(
              "name",
              sourceInputName,
            )[0];
            if (sourceInput) {
              edges.push({
                id: `edge_${sourceInput.$id}_to_${task.$id}_${arg.name}`,
                source: sourceInput.$id,
                sourceHandle: `output_${sourceInputName}`,
                target: task.$id,
                targetHandle: `input_${arg.name}`,
                type: "default",
              });
            }
          }
        } else if (argType === "taskOutput") {
          // Edge from another task's output
          const argJson = arg.toJson();
          if (typeof argJson === "object" && "taskOutput" in argJson) {
            const { taskId: sourceTaskName, outputName } = argJson.taskOutput;
            // Find source task by name to get its $id
            const sourceTask = spec.implementation.tasks.findByIndex(
              "name",
              sourceTaskName,
            )[0];
            if (sourceTask) {
              edges.push({
                id: `edge_${sourceTask.$id}_${outputName}_to_${task.$id}_${arg.name}`,
                source: sourceTask.$id,
                sourceHandle: `output_${outputName}`,
                target: task.$id,
                targetHandle: `input_${arg.name}`,
                type: "default",
              });
            }
          }
        }
        // Literal values don't create edges
      }
    });

    // Create edges for graph output values
    const outputValues = spec.implementation.getOutputValues();
    for (const binding of outputValues) {
      // Find task and output entities by name to get their $ids
      const sourceTask = spec.implementation.tasks.findByIndex(
        "name",
        binding.taskId,
      )[0];
      const targetOutput = spec.outputs.findByIndex(
        "name",
        binding.outputName,
      )[0];
      if (sourceTask && targetOutput) {
        edges.push({
          id: `edge_${sourceTask.$id}_${binding.taskOutputName}_to_${targetOutput.$id}`,
          source: sourceTask.$id,
          sourceHandle: `output_${binding.taskOutputName}`,
          target: targetOutput.$id,
          targetHandle: `input_${binding.outputName}`,
          type: "default",
        });
      }
    }
  }

  return { nodes, edges };
}
