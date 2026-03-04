import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";

import type {
  GraphSpec,
  InputSpec,
  MetadataSpec,
  OutputSpec,
  TaskSpec,
} from "@/utils/componentSpec";
import { isScalar } from "@/utils/types";

import { useComponentSpecStore } from "./componentSpecStore";
import { serializePath } from "./types";

// ---- Task-level selectors ----

/**
 * Returns a single task's spec from the store.
 * Only re-renders when THIS specific task changes.
 */
export const useTaskSpec = (taskId: string): TaskSpec | undefined => {
  return useComponentSpecStore(
    useCallback(
      (state) => {
        const pathKey = serializePath(state.currentSubgraphPath);
        return state.graphs[pathKey]?.tasks[taskId];
      },
      [taskId],
    ),
  );
};

// ---- Graph-level selectors ----

/**
 * Returns the current subgraph's inputs.
 */
export const useCurrentGraphInputs = (): InputSpec[] | undefined => {
  return useComponentSpecStore(
    useCallback((state) => {
      const pathKey = serializePath(state.currentSubgraphPath);
      return state.graphs[pathKey]?.inputs;
    }, []),
  );
};

/**
 * Returns the current subgraph's outputs.
 */
export const useCurrentGraphOutputs = (): OutputSpec[] | undefined => {
  return useComponentSpecStore(
    useCallback((state) => {
      const pathKey = serializePath(state.currentSubgraphPath);
      return state.graphs[pathKey]?.outputs;
    }, []),
  );
};

/**
 * Returns the current graph as a GraphSpec (tasks + outputValues).
 * Used by components that need a GraphSpec-shaped object.
 */
export const useCurrentGraphSpec = (): GraphSpec => {
  return useComponentSpecStore(
    useShallow((state) => {
      const pathKey = serializePath(state.currentSubgraphPath);
      const graph = state.graphs[pathKey];
      if (!graph) return { tasks: {} };
      return {
        tasks: graph.tasks,
        ...(graph.outputValues ? { outputValues: graph.outputValues } : {}),
      };
    }),
  );
};

/**
 * Returns the root graph level (graphs["root"]).
 * Used by components that need the root graph spec regardless of subgraph navigation.
 */
export const useRootGraphSpec = (): GraphSpec => {
  return useComponentSpecStore(
    useShallow((state) => {
      const graph = state.graphs.root;
      if (!graph) return { tasks: {} };
      return {
        tasks: graph.tasks,
        ...(graph.outputValues ? { outputValues: graph.outputValues } : {}),
      };
    }),
  );
};

/**
 * Returns the current subgraph path from the store.
 */
export const useCurrentSubgraphPath = (): string[] => {
  return useComponentSpecStore(
    useCallback((state) => state.currentSubgraphPath, []),
  );
};

// ---- Root-level selectors ----

/**
 * Returns the root pipeline name. Only re-renders when the name changes.
 */
export const useRootName = (): string | undefined => {
  return useComponentSpecStore(
    useCallback((state) => state.graphs.root?.name, []),
  );
};

/**
 * Returns the root pipeline description.
 */
export const useRootDescription = (): string | undefined => {
  return useComponentSpecStore(
    useCallback((state) => state.graphs.root?.description, []),
  );
};

/**
 * Returns the root pipeline metadata.
 */
export const useRootMetadata = (): MetadataSpec | undefined => {
  return useComponentSpecStore(
    useCallback((state) => state.graphs.root?.metadata, []),
  );
};

/**
 * Returns the root graph's inputs (not following subgraph navigation).
 */
export const useRootInputs = (): InputSpec[] | undefined => {
  return useComponentSpecStore(
    useCallback((state) => state.graphs.root?.inputs, []),
  );
};

/**
 * Returns the root graph's outputs (not following subgraph navigation).
 */
export const useRootOutputs = (): OutputSpec[] | undefined => {
  return useComponentSpecStore(
    useCallback((state) => state.graphs.root?.outputs, []),
  );
};

// ---- Fingerprint selectors ----

/**
 * Returns a structural fingerprint of the current graph that changes only when:
 * - Tasks are added or removed
 * - Inputs/outputs are added, removed, or renamed
 * - Task annotations change (positions are stored in annotations)
 *
 * Does NOT change when task arguments/executionOptions change.
 * Used by FlowCanvas to decide when to recreate React Flow nodes.
 */
export const useGraphStructuralFingerprint = (): string => {
  return useComponentSpecStore(
    useCallback((state) => {
      const pathKey = serializePath(state.currentSubgraphPath);
      const graph = state.graphs[pathKey];
      if (!graph) return "";

      // Task IDs + their annotation hashes (positions live in annotations)
      const taskParts = Object.entries(graph.tasks)
        .map(
          ([id, task]) =>
            `${id}:${task.componentRef?.digest ?? task.componentRef?.name ?? ""}:${JSON.stringify(task.annotations ?? {})}`,
        )
        .sort();

      // Input/output names
      const inputParts = (graph.inputs ?? []).map((i) => `i:${i.name}`);
      const outputParts = (graph.outputs ?? []).map((o) => `o:${o.name}`);

      return [...taskParts, ...inputParts, ...outputParts].join("|");
    }, []),
  );
};

/**
 * Returns a fingerprint that only changes when connections between nodes change.
 * Scalar argument edits (string values) do NOT trigger this.
 * Used by useComponentSpecToEdges to avoid recomputing edges on every edit.
 */
export const useConnectionFingerprint = (): string => {
  return useComponentSpecStore(
    useCallback((state) => {
      const pathKey = serializePath(state.currentSubgraphPath);
      const graph = state.graphs[pathKey];
      if (!graph) return "";

      const parts: string[] = [];

      for (const [taskId, task] of Object.entries(graph.tasks)) {
        for (const [argName, arg] of Object.entries(task.arguments ?? {})) {
          if (!isScalar(arg) && typeof arg === "object" && arg !== null) {
            if ("taskOutput" in arg || "graphInput" in arg) {
              parts.push(`${taskId}:${argName}:${JSON.stringify(arg)}`);
            }
          }
        }
      }

      if (graph.outputValues) {
        for (const [name, val] of Object.entries(graph.outputValues)) {
          parts.push(`out:${name}:${JSON.stringify(val)}`);
        }
      }

      return parts.sort().join("|");
    }, []),
  );
};
