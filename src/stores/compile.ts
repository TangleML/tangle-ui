import type { ComponentSpec, GraphSpec, TaskSpec } from "@/utils/componentSpec";

import type { NormalizedGraphLevel } from "./types";
import { serializePath } from "./types";

/**
 * Compiles normalized graph levels back into a full ComponentSpec tree.
 *
 * Walks the `graphs` map starting from the given path. For each task that
 * has a decomposed subgraph entry, recursively compiles and embeds the
 * nested ComponentSpec into the task's `componentRef.spec`.
 */
export const compileComponentSpec = (
  graphs: Record<string, NormalizedGraphLevel>,
  path: string[] = ["root"],
): ComponentSpec => {
  const pathKey = serializePath(path);
  const graph = graphs[pathKey];

  if (!graph) {
    throw new Error(`No graph found for path: ${pathKey}`);
  }

  const compiledTasks: Record<string, TaskSpec> = {};

  for (const [taskId, taskSpec] of Object.entries(graph.tasks)) {
    const nestedPathKey = serializePath([...path, taskId]);

    if (graphs[nestedPathKey]) {
      const nestedSpec = compileComponentSpec(graphs, [...path, taskId]);
      compiledTasks[taskId] = {
        ...taskSpec,
        componentRef: {
          ...taskSpec.componentRef,
          spec: nestedSpec,
        },
      };
    } else {
      compiledTasks[taskId] = taskSpec;
    }
  }

  const graphSpec: GraphSpec = {
    tasks: compiledTasks,
    ...(graph.outputValues ? { outputValues: graph.outputValues } : {}),
  };

  const spec: ComponentSpec = {
    ...(graph.name !== undefined ? { name: graph.name } : {}),
    ...(graph.description !== undefined
      ? { description: graph.description }
      : {}),
    ...(graph.inputs ? { inputs: graph.inputs } : {}),
    ...(graph.outputs ? { outputs: graph.outputs } : {}),
    implementation: { graph: graphSpec },
    ...(graph.metadata ? { metadata: graph.metadata } : {}),
  };

  return spec;
};
