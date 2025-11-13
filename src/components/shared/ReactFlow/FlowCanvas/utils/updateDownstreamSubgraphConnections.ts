import {
  type ComponentSpec,
  isGraphImplementation,
  isTaskOutputArgument,
} from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";
import {
  type ConnectionMapping,
  GRAPH_OUTPUT,
  PLACEHOLDER_SUBGRAPH_ID,
} from "@/utils/nodes/createSubgraphFromNodes";

/**
 * Updates downstream connections after replacing multiple tasks with a single replacement task.
 *
 * Handles two scenarios:
 * 1. External task arguments that reference outputs from the original tasks
 * 2. Graph-level output values that reference outputs from the original tasks
 *
 * For each connection:
 * - If the replacement task has a matching output, the connection is redirected
 * - If no matching output exists, the connection is removed
 *
 * @param componentSpec - The component specification containing the graph
 * @param connectionMappings - Array of connection mappings for task outputs
 * @returns Updated component specification with redirected connections
 *
 */

export const updateDownstreamSubgraphConnections = (
  componentSpec: ComponentSpec,
  connectionMappings: ConnectionMapping[],
): ComponentSpec => {
  if (connectionMappings.length === 0) {
    return componentSpec;
  }

  const updatedComponentSpec = deepClone(componentSpec);

  if (!isGraphImplementation(updatedComponentSpec.implementation)) {
    return updatedComponentSpec;
  }

  const updatedGraphSpec = updatedComponentSpec.implementation.graph;

  connectionMappings.forEach((mapping) => {
    if (mapping.newTaskId.includes(PLACEHOLDER_SUBGRAPH_ID)) {
      throw new Error("ConnectionMapping contains placeholder newTaskId");
    }

    if (mapping.targetTaskId === GRAPH_OUTPUT) {
      // Update graph output
      const graphOutput =
        updatedGraphSpec?.outputValues?.[mapping.targetInputName];
      if (graphOutput && isTaskOutputArgument(graphOutput)) {
        graphOutput.taskOutput = {
          ...graphOutput.taskOutput,
          taskId: mapping.newTaskId,
          outputName: mapping.newOutputName,
        };
      }
    } else {
      // Update task argument
      const targetTask = updatedGraphSpec.tasks[mapping.targetTaskId];
      const targetTaskArg = targetTask?.arguments?.[mapping.targetInputName];
      if (isTaskOutputArgument(targetTaskArg)) {
        targetTaskArg.taskOutput = {
          ...targetTaskArg.taskOutput,
          taskId: mapping.newTaskId,
          outputName: mapping.newOutputName,
        };
      }
    }
  });

  updatedComponentSpec.implementation.graph = updatedGraphSpec;

  return updatedComponentSpec;
};
