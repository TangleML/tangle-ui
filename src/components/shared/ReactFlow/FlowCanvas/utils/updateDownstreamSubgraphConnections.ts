import type { OutputSpec, TaskOutputArgument } from "@/api/types.gen";
import {
  type ComponentSpec,
  isGraphImplementation,
  isTaskOutputArgument,
} from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";

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
 * @param originalTaskIds - Array of task IDs that are being replaced
 * @param replacementTaskId - The ID of the task that replaces the original tasks
 * @returns Updated component specification with redirected connections
 *
 */

export const updateDownstreamSubgraphConnections = (
  componentSpec: ComponentSpec,
  originalTaskIds: string[],
  replacementTaskId: string,
): ComponentSpec => {
  if (originalTaskIds.length === 0) {
    return componentSpec;
  }

  const updatedComponentSpec = deepClone(componentSpec);

  if (!isGraphImplementation(updatedComponentSpec.implementation)) {
    return updatedComponentSpec;
  }

  const updatedGraphSpec = updatedComponentSpec.implementation.graph;

  const replacementTaskSpec = updatedGraphSpec.tasks[replacementTaskId];
  const replacementOutputs =
    replacementTaskSpec?.componentRef?.spec?.outputs || [];

  const originalTaskIdSet = new Set(originalTaskIds);

  // Scenario 1: TaskOutput connected to TaskInput
  Object.values(updatedGraphSpec.tasks).forEach((task) => {
    if (!task.arguments) return;

    const updatedArguments = { ...task.arguments };

    Object.entries(updatedArguments).forEach(([inputName, argument]) => {
      if (!isTaskOutputArgument(argument)) return;

      if (!originalTaskIdSet.has(argument.taskOutput.taskId)) return;

      const reassignedArgument = reassignTaskOutput(
        argument,
        replacementTaskId,
        replacementOutputs,
      );

      if (!reassignedArgument) {
        delete updatedArguments[inputName];
      } else {
        updatedArguments[inputName] = reassignedArgument;
      }
    });

    task.arguments = updatedArguments;
  });

  // Scenario 2: TaskOutput connected to GraphOutput
  if (updatedGraphSpec.outputValues) {
    Object.entries(updatedGraphSpec.outputValues).forEach(
      ([outputName, outputValue]) => {
        if (!updatedGraphSpec.outputValues) return;

        if (!originalTaskIdSet.has(outputValue.taskOutput.taskId)) return;

        const reassignedOutputValue = reassignTaskOutput(
          outputValue,
          replacementTaskId,
          replacementOutputs,
        );

        if (!reassignedOutputValue) {
          delete updatedGraphSpec.outputValues[outputName];
        } else {
          updatedGraphSpec.outputValues[outputName] = reassignedOutputValue;
        }
      },
    );
  }

  updatedComponentSpec.implementation.graph = updatedGraphSpec;

  return updatedComponentSpec;
};

function reassignTaskOutput(
  argument: TaskOutputArgument,
  replacementTaskId: string,
  replacementOutputs: OutputSpec[],
): TaskOutputArgument | undefined {
  const outputName = argument.taskOutput.outputName;
  const isReconfiguredOutput = replacementOutputs.some(
    (output) => output.name === outputName.replace(/_/g, " "),
  );

  if (isReconfiguredOutput) {
    // Update the taskOutput to point to the replacement taskId
    return {
      ...argument,
      taskOutput: {
        ...argument.taskOutput,
        taskId: replacementTaskId,
      },
    };
  } else {
    // This output no longer exists in the replacement task (it should be removed)
    return undefined;
  }
}
