import type { Edge, Node } from "@xyflow/react";
import { useRef } from "react";
import { useSnapshot } from "valtio";

import type { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

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
 * Create a fingerprint of the spec's structure for change detection.
 * This includes IDs and names of inputs, outputs, tasks, and bindings.
 *
 * IMPORTANT: This function must access data through the snapshot to establish
 * Valtio subscriptions. The snapshot is a readonly view, so we access the
 * entities record directly which is tracked by Valtio.
 */
/**
 * Extract position string from annotations snapshot for fingerprinting.
 */
function getPositionFingerprint(
  annotations: Record<string, { key: string; value: unknown }> | undefined,
): string {
  if (!annotations) return "";
  const posAnnotation = Object.values(annotations).find(
    (a) => a.key === EDITOR_POSITION_ANNOTATION,
  );
  return posAnnotation ? String(posAnnotation.value) : "";
}

function createSpecFingerprint(
  spec: ComponentSpecEntity,
  snapshot: unknown,
): string {
  // Cast snapshot to access its properties (readonly view of spec)
  const snap = snapshot as {
    $id: string;
    inputs: {
      entities: Record<
        string,
        {
          $id: string;
          name: string;
          annotations?: {
            entities: Record<string, { key: string; value: unknown }>;
          };
        }
      >;
    };
    outputs: {
      entities: Record<
        string,
        {
          $id: string;
          name: string;
          annotations?: {
            entities: Record<string, { key: string; value: unknown }>;
          };
        }
      >;
    };
    implementation?: {
      tasks: {
        entities: Record<
          string,
          {
            $id: string;
            name: string;
            annotations: {
              entities: Record<string, { key: string; value: unknown }>;
            };
          }
        >;
      };
      bindings: { entities: Record<string, { $id: string }> };
    };
  };

  const parts: string[] = [snap.$id];

  // Input IDs, names, and positions - access through snapshot to establish subscription
  // Include positions so fingerprint changes when inputs are moved (for undo support)
  const inputEntries = Object.entries(snap.inputs.entities)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([id, entity]) =>
        `${id}:${entity.name}:${getPositionFingerprint(entity.annotations?.entities)}`,
    );
  parts.push(`i:${inputEntries.join(",")}`);

  // Output IDs, names, and positions - access through snapshot to establish subscription
  // Include positions so fingerprint changes when outputs are moved (for undo support)
  const outputEntries = Object.entries(snap.outputs.entities)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([id, entity]) =>
        `${id}:${entity.name}:${getPositionFingerprint(entity.annotations?.entities)}`,
    );
  parts.push(`o:${outputEntries.join(",")}`);

  // Task IDs, names, positions, and bindings (if graph implementation)
  if (hasGraphImplementation(spec) && snap.implementation) {
    // Include task positions so fingerprint changes when tasks are moved (for undo support)
    const taskEntries = Object.entries(snap.implementation.tasks.entities)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([id, entity]) =>
          `${id}:${entity.name}:${getPositionFingerprint(entity.annotations.entities)}`,
      );
    parts.push(`t:${taskEntries.join(",")}`);

    const bindingIds = Object.keys(
      snap.implementation.bindings.entities,
    ).sort();
    parts.push(`b:${bindingIds.join(",")}`);
  }

  return parts.join("|");
}

/**
 * Build nodes and edges from a spec.
 */
function buildNodesAndEdges(spec: ComponentSpecEntity): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

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
        name: input.name,
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
        name: output.name,
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
          name: task.name,
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

/**
 * Convert a ComponentSpecEntity to ReactFlow nodes and edges.
 *
 * Node data only contains stable entity $id references.
 * Node components fetch actual data from the store using these ids,
 * which ensures valtio reactivity works correctly.
 *
 * Uses caching with fingerprint-based change detection to avoid
 * creating new references on every render (which would cause infinite loops).
 *
 * @param spec - The ComponentSpecEntity to convert (must be a valtio proxy)
 * @returns Object containing nodes and edges arrays for ReactFlow
 */
export function useSpecToNodesEdges(spec: ComponentSpecEntity | null) {
  // Cache the result to avoid infinite loops
  const cacheRef = useRef<{
    fingerprint: string;
    result: { nodes: Node[]; edges: Edge[] };
  }>({ fingerprint: "", result: EMPTY_RESULT });

  // Create a stable dummy object for when spec is null
  // This allows useSnapshot to be called unconditionally
  const dummySpec = useRef({ name: "" });

  // Use valtio snapshot to subscribe to spec changes
  // The snapshot triggers re-renders when the spec is mutated
  const snapshot = useSnapshot(spec ?? dummySpec.current);

  // Create a fingerprint of the current spec structure
  // IMPORTANT: Pass snapshot to createSpecFingerprint so Valtio tracks the accessed properties
  const currentFingerprint = spec ? createSpecFingerprint(spec, snapshot) : "";

  // Only recalculate if the fingerprint changed
  if (currentFingerprint !== cacheRef.current.fingerprint) {
    if (!spec) {
      cacheRef.current = { fingerprint: "", result: EMPTY_RESULT };
    } else {
      cacheRef.current = {
        fingerprint: currentFingerprint,
        result: buildNodesAndEdges(spec),
      };
    }
  }

  return cacheRef.current.result;
}
