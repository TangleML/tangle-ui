import type { XYPosition } from "@xyflow/react";

import type { ComponentSpec } from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";
import { nodeIdToTaskId } from "@/utils/nodes/nodeIdUtils";

import addTask from "./addTask";
import { setGraphOutputValue } from "./setGraphOutputValue";
import { setTaskArgument } from "./setTaskArgument";

/**
 * Creates an output node and connects it to a task's output
 */
export const createConnectedOutputNode = (
  componentSpec: ComponentSpec,
  taskNodeId: string,
  outputHandleId: string,
  position: XYPosition,
): ComponentSpec => {
  const taskId = nodeIdToTaskId(taskNodeId);
  const outputArgName = outputHandleId.replace("output_", "");

  const { spec: specWithOutput } = addTask(
    "output",
    null,
    position,
    componentSpec,
  );

  if (!isGraphImplementation(specWithOutput.implementation)) {
    return componentSpec;
  }

  const outputName =
    specWithOutput.outputs?.[specWithOutput.outputs.length - 1]?.name;
  if (!outputName) {
    return componentSpec;
  }

  const updatedGraph = setGraphOutputValue(
    specWithOutput.implementation.graph,
    outputName,
    {
      taskOutput: {
        taskId,
        outputName: outputArgName,
      },
    },
  );

  return {
    ...specWithOutput,
    implementation: {
      graph: updatedGraph,
    },
  };
};

/**
 * Creates an input node and connects it to a task's input
 */
export const createConnectedInputNode = (
  componentSpec: ComponentSpec,
  taskNodeId: string,
  inputHandleId: string,
  position: XYPosition,
): ComponentSpec => {
  const taskId = nodeIdToTaskId(taskNodeId);
  const inputArgName = inputHandleId.replace("input_", "");

  const { spec: specWithInput } = addTask(
    "input",
    null,
    position,
    componentSpec,
  );

  if (!isGraphImplementation(specWithInput.implementation)) {
    return componentSpec;
  }

  const inputName =
    specWithInput.inputs?.[specWithInput.inputs.length - 1]?.name;
  if (!inputName) {
    return componentSpec;
  }

  const updatedGraph = setTaskArgument(
    specWithInput.implementation.graph,
    taskId,
    inputArgName,
    {
      graphInput: {
        inputName,
      },
    },
  );

  return {
    ...specWithInput,
    implementation: {
      graph: updatedGraph,
    },
  };
};
