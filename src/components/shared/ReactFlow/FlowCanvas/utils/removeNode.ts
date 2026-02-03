import { type Node } from "@xyflow/react";

import { FLEX_NODES_ANNOTATION } from "@/utils/annotations";
import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import {
  nodeIdToInputName,
  nodeIdToOutputName,
  nodeIdToTaskId,
} from "@/utils/nodes/nodeIdUtils";

import { removeFlexNodeFromComponentSpec } from "../FlexNode/interface";
import { setGraphOutputValue } from "./setGraphOutputValue";
import { setTaskArgument } from "./setTaskArgument";

export const removeNode = (node: Node, componentSpec: ComponentSpec) => {
  if (node.type === "task") {
    const taskId = nodeIdToTaskId(node.id);
    return removeTask(taskId, componentSpec);
  }

  if (node.type === "input") {
    const inputName = nodeIdToInputName(node.id);
    return removeGraphInput(inputName, componentSpec);
  }

  if (node.type === "output") {
    const outputName = nodeIdToOutputName(node.id);
    return removeGraphOutput(outputName, componentSpec);
  }

  if (node.type === "flex") {
    return removeFlexNode(node.id, componentSpec);
  }

  return componentSpec;
};

export const removeGraphInput = (
  inputNameToRemove: string,
  componentSpec: ComponentSpec,
) => {
  if (isGraphImplementation(componentSpec.implementation)) {
    const graphSpec = componentSpec.implementation.graph;
    for (const [taskId, taskSpec] of Object.entries(graphSpec.tasks)) {
      for (const [inputName, argument] of Object.entries(
        taskSpec.arguments ?? {},
      )) {
        if (typeof argument !== "string" && "graphInput" in argument) {
          if (argument.graphInput.inputName === inputNameToRemove) {
            const newGraphSpec = setTaskArgument(
              componentSpec.implementation.graph,
              taskId,
              inputName,
            );
            componentSpec.implementation.graph = newGraphSpec;
          }
        }
      }
    }
  }

  const newInputs = (componentSpec.inputs ?? []).filter(
    (inputSpec) => inputSpec.name !== inputNameToRemove,
  );

  return { ...componentSpec, inputs: newInputs };
};

export const removeGraphOutput = (
  outputNameToRemove: string,
  componentSpec: ComponentSpec,
) => {
  if (isGraphImplementation(componentSpec.implementation)) {
    const graphSpec = componentSpec.implementation.graph;
    const newGraphSpec = setGraphOutputValue(graphSpec, outputNameToRemove);
    componentSpec.implementation.graph = newGraphSpec;

    // Removing the output itself
    const newOutputs = (componentSpec.outputs ?? []).filter(
      (outputSpec) => outputSpec.name !== outputNameToRemove,
    );
    return { ...componentSpec, outputs: newOutputs };
  }

  return componentSpec;
};

export const removeTask = (
  taskIdToRemove: string,
  componentSpec: ComponentSpec,
) => {
  if (isGraphImplementation(componentSpec.implementation)) {
    const graphSpec = componentSpec.implementation.graph;

    // Step 1: Remove any connections where this task is used as a source
    // (i.e., other tasks that depend on this task's outputs)
    for (const [taskId, taskSpec] of Object.entries(graphSpec.tasks)) {
      if (!taskSpec.arguments) continue;

      for (const [inputName, argument] of Object.entries(taskSpec.arguments)) {
        // Check if this argument references the task we're removing
        const isReferencingRemovedTask =
          typeof argument !== "string" &&
          "taskOutput" in argument &&
          argument.taskOutput.taskId === taskIdToRemove;

        if (isReferencingRemovedTask) {
          const newGraphSpec = setTaskArgument(
            componentSpec.implementation.graph,
            taskId,
            inputName,
          );
          componentSpec.implementation.graph = newGraphSpec;
        }
      }
    }

    // Step 2: Remove any connections from this task to graph outputs
    const newGraphOutputValues = Object.fromEntries(
      Object.entries(graphSpec.outputValues ?? {}).filter(
        ([_, argument]) => argument.taskOutput.taskId !== taskIdToRemove,
      ),
    );

    // Step 3: Remove the task itself from the graph
    const newTasks = Object.fromEntries(
      Object.entries(graphSpec.tasks).filter(
        ([taskId]) => taskId !== taskIdToRemove,
      ),
    );

    // Step 4: Update the graph spec with our changes
    const newGraphSpec = {
      ...componentSpec.implementation.graph,
      tasks: newTasks,
      outputValues: newGraphOutputValues,
    };

    return {
      ...componentSpec,
      ...(componentSpec.implementation.graph && {
        implementation: {
          ...componentSpec.implementation,
          graph: newGraphSpec,
        },
      }),
    };
  }

  return componentSpec;
};

const removeFlexNode = (
  nodeIdToRemove: string,
  componentSpec: ComponentSpec,
) => {
  const annotations = componentSpec.metadata?.annotations;
  if (annotations && annotations[FLEX_NODES_ANNOTATION]) {
    return removeFlexNodeFromComponentSpec(componentSpec, nodeIdToRemove);
  }

  return componentSpec;
};
