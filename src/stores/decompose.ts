import type { ComponentSpec } from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";
import { isSubgraph } from "@/utils/subgraphUtils";

import { type NormalizedGraphLevel, serializePath } from "./types";

interface DecomposeResult {
  graphs: Record<string, NormalizedGraphLevel>;
}

/**
 * Decomposes a ComponentSpec into normalized graph levels.
 *
 * Each graph level (root and nested subgraphs) gets its own entry keyed
 * by the serialized subgraph path. Tasks within each level are individual
 * references that can be updated independently.
 *
 * Nested subgraphs are decomposed recursively so that compile() can
 * reconstruct the full tree.
 */
export const decomposeComponentSpec = (
  spec: ComponentSpec,
  subgraphPath: string[] = ["root"],
): DecomposeResult => {
  const graphs: Record<string, NormalizedGraphLevel> = {};
  const pathKey = serializePath(subgraphPath);

  if (!isGraphImplementation(spec.implementation)) {
    graphs[pathKey] = {
      name: spec.name,
      description: spec.description,
      inputs: spec.inputs,
      outputs: spec.outputs,
      metadata: spec.metadata,
      tasks: {},
    };
    return { graphs };
  }

  const graphSpec = spec.implementation.graph;

  graphs[pathKey] = {
    name: spec.name,
    description: spec.description,
    inputs: spec.inputs,
    outputs: spec.outputs,
    metadata: spec.metadata,
    tasks: { ...graphSpec.tasks },
    outputValues: graphSpec.outputValues
      ? { ...graphSpec.outputValues }
      : undefined,
  };

  for (const [taskId, taskSpec] of Object.entries(graphSpec.tasks)) {
    if (isSubgraph(taskSpec) && taskSpec.componentRef.spec) {
      const nestedResult = decomposeComponentSpec(taskSpec.componentRef.spec, [
        ...subgraphPath,
        taskId,
      ]);
      Object.assign(graphs, nestedResult.graphs);
    }
  }

  return { graphs };
};
