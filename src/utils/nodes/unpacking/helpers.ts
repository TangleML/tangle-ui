import type { XYPosition } from "@xyflow/react";

import addTask from "@/components/shared/ReactFlow/FlowCanvas/utils/addTask";
import { setGraphOutputValue } from "@/components/shared/ReactFlow/FlowCanvas/utils/setGraphOutputValue";
import {
  type ArgumentType,
  type ComponentSpec,
  isGraphImplementation,
  isGraphInputArgument,
  isTaskOutputArgument,
  type MetadataSpec,
  type TaskOutputArgument,
} from "@/utils/componentSpec";
import {
  calculateSpecCenter,
  normalizeNodePositionInGroup,
} from "@/utils/graphUtils";

import { extractPositionFromAnnotations } from "../extractPositionFromAnnotations";

export const unpackInputs = (
  containerSpec: ComponentSpec,
  containerPosition: XYPosition,
  componentSpec: ComponentSpec,
): {
  spec: ComponentSpec;
  inputNameMap: Map<string, string>;
} => {
  let updatedSpec = componentSpec;
  const inputNameMap = new Map<string, string>();

  const containerCenter = calculateSpecCenter(containerSpec);

  const inputs = containerSpec.inputs;

  inputs?.forEach((input) => {
    const position = calculateUnpackedPosition(
      input.annotations,
      containerPosition,
      containerCenter,
    );

    const { spec, ioName } = addTask(
      "input",
      null,
      position,
      updatedSpec,
      input,
    );

    if (ioName && ioName !== input.name) {
      inputNameMap.set(input.name, ioName);
    }

    updatedSpec = spec;
  });

  return { spec: updatedSpec, inputNameMap };
};

export const unpackOutputs = (
  containerSpec: ComponentSpec,
  containerPosition: XYPosition,
  componentSpec: ComponentSpec,
): {
  spec: ComponentSpec;
  outputNameMap: Map<string, string>;
} => {
  let updatedSpec = componentSpec;
  const outputNameMap = new Map<string, string>();

  const containerCenter = calculateSpecCenter(containerSpec);

  const outputs = containerSpec.outputs;

  outputs?.forEach((output) => {
    const position = calculateUnpackedPosition(
      output.annotations,
      containerPosition,
      containerCenter,
    );

    const { spec, ioName } = addTask(
      "output",
      null,
      position,
      updatedSpec,
      output,
    );

    if (ioName && ioName !== output.name) {
      outputNameMap.set(output.name, ioName);
    }

    updatedSpec = spec;
  });

  return { spec: updatedSpec, outputNameMap };
};

export const unpackTasks = (
  containerSpec: ComponentSpec,
  containerPosition: XYPosition,
  componentSpec: ComponentSpec,
  inputNameMap: Map<string, string>,
): {
  spec: ComponentSpec;
  taskIdMap: Map<string, string>;
} => {
  let updatedSpec = componentSpec;
  const taskIdMap = new Map<string, string>();

  if (!isGraphImplementation(containerSpec.implementation)) {
    return { spec: updatedSpec, taskIdMap };
  }

  const containerCenter = calculateSpecCenter(containerSpec);

  const tasks = containerSpec.implementation.graph.tasks;

  Object.entries(tasks).forEach(([taskId, task]) => {
    const position = calculateUnpackedPosition(
      task.annotations,
      containerPosition,
      containerCenter,
    );

    const { spec, taskId: newTaskId } = addTask(
      "task",
      task,
      position,
      updatedSpec,
    );

    if (newTaskId && newTaskId !== taskId) {
      taskIdMap.set(taskId, newTaskId);
    }

    updatedSpec = spec;
  });

  if (!isGraphImplementation(updatedSpec.implementation)) {
    return { spec: updatedSpec, taskIdMap };
  }

  const updatedTasks = { ...updatedSpec.implementation.graph.tasks };

  Object.entries(tasks).forEach(([oldTaskId, task]) => {
    const newTaskId = taskIdMap.get(oldTaskId) || oldTaskId;
    const currentTask = updatedTasks[newTaskId];

    if (!currentTask) {
      return;
    }

    const remappedArguments = remapTaskArguments(
      task.arguments,
      taskIdMap,
      inputNameMap,
    );

    if (remappedArguments) {
      updatedTasks[newTaskId] = {
        ...currentTask,
        arguments: remappedArguments,
      };
    }
  });

  updatedSpec = {
    ...updatedSpec,
    implementation: {
      ...updatedSpec.implementation,
      graph: {
        ...updatedSpec.implementation.graph,
        tasks: updatedTasks,
      },
    },
  };

  return { spec: updatedSpec, taskIdMap };
};

export const copyOutputValues = (
  containerSpec: ComponentSpec,
  componentSpec: ComponentSpec,
  outputNameMap: Map<string, string>,
  taskIdMap: Map<string, string>,
): ComponentSpec => {
  let updatedSpec = componentSpec;

  if (!isGraphImplementation(containerSpec.implementation)) {
    return updatedSpec;
  }

  const outputValues = containerSpec.implementation.graph.outputValues || {};

  Object.entries(outputValues).forEach(([outputName, outputValue]) => {
    if (isGraphImplementation(updatedSpec.implementation)) {
      const newOutputName = outputNameMap.get(outputName) || outputName;
      const remappedTaskOutputArg = remapTaskOutputArgument(
        outputValue,
        taskIdMap,
      );

      const updatedGraphSpec = setGraphOutputValue(
        updatedSpec.implementation.graph,
        newOutputName,
        remappedTaskOutputArg,
      );

      updatedSpec = {
        ...updatedSpec,
        implementation: {
          ...updatedSpec.implementation,
          graph: updatedGraphSpec,
        },
      };
    }
  });

  return updatedSpec;
};

const remapTaskOutputArgument = (
  taskOutput: TaskOutputArgument,
  taskIdMap: Map<string, string>,
): TaskOutputArgument => {
  const newTaskId =
    taskIdMap.get(taskOutput.taskOutput.taskId) || taskOutput.taskOutput.taskId;

  return {
    taskOutput: {
      ...taskOutput.taskOutput,
      taskId: newTaskId,
    },
  };
};

const remapArgumentValue = (
  arg: ArgumentType,
  taskIdMap: Map<string, string>,
  inputNameMap: Map<string, string>,
) => {
  if (isTaskOutputArgument(arg)) {
    return remapTaskOutputArgument(arg, taskIdMap);
  }

  if (isGraphInputArgument(arg)) {
    const newInputName =
      inputNameMap.get(arg.graphInput.inputName) || arg.graphInput.inputName;
    return {
      graphInput: {
        ...arg.graphInput,
        inputName: newInputName,
      },
    };
  }

  return arg;
};

const remapTaskArguments = (
  args: Record<string, ArgumentType> | undefined,
  taskIdMap: Map<string, string>,
  inputNameMap: Map<string, string>,
) => {
  if (!args) return undefined;

  const remappedArgs: Record<string, ArgumentType> = {};

  for (const [key, value] of Object.entries(args)) {
    remappedArgs[key] = remapArgumentValue(value, taskIdMap, inputNameMap);
  }

  return remappedArgs;
};

const calculateUnpackedPosition = (
  nodeAnnotations: MetadataSpec["annotations"],
  containerPosition: XYPosition,
  containerCenter: XYPosition,
): XYPosition => {
  const nodePosition = extractPositionFromAnnotations(nodeAnnotations);
  return normalizeNodePositionInGroup(
    nodePosition,
    containerPosition,
    containerCenter,
  );
};
