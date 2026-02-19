import type { XYPosition } from "@xyflow/react";

import {
  getFlexNodeAnnotations,
  serializeFlexNodes,
} from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/interface";
import addTask from "@/components/shared/ReactFlow/FlowCanvas/utils/addTask";
import { setGraphOutputValue } from "@/components/shared/ReactFlow/FlowCanvas/utils/setGraphOutputValue";
import { setTaskArgument } from "@/components/shared/ReactFlow/FlowCanvas/utils/setTaskArgument";
import {
  extractPositionFromAnnotations,
  FLEX_NODES_ANNOTATION,
} from "@/utils/annotations";
import {
  type ArgumentType,
  type ComponentSpec,
  type GraphSpec,
  isGraphImplementation,
  isGraphInputArgument,
  isTaskOutputArgument,
  type MetadataSpec,
  type TaskOutputArgument,
} from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";
import {
  calculateSpecCenter,
  getArgumentsWithUpstreamConnections,
  getDownstreamTaskNodesConnectedToTask,
  getOutputNodesConnectedToTask,
  normalizeNodePositionInGroup,
} from "@/utils/graphUtils";

export const unpackFlexNodes = (
  containerSpec: ComponentSpec,
  containerPosition: XYPosition,
  componentSpec: ComponentSpec,
): ComponentSpec => {
  const updatedSpec = componentSpec;

  const flexNodes = getFlexNodeAnnotations(containerSpec);

  const containerCenter = calculateSpecCenter(containerSpec);

  const newFlexNodes = flexNodes.map((flexNode) => {
    const position = normalizeNodePositionInGroup(
      {
        x: flexNode.position.x,
        y: flexNode.position.y,
      },
      containerPosition,
      containerCenter,
    );

    return {
      ...flexNode,
      position,
    };
  });

  if (!updatedSpec.metadata) {
    updatedSpec.metadata = {};
  }

  if (!updatedSpec.metadata.annotations) {
    updatedSpec.metadata.annotations = {};
  }

  const existingFlexNodes = getFlexNodeAnnotations(updatedSpec);

  const mergedFlexNodes = [...existingFlexNodes, ...newFlexNodes];

  updatedSpec.metadata.annotations[FLEX_NODES_ANNOTATION] =
    serializeFlexNodes(mergedFlexNodes);

  return updatedSpec;
};

export const unpackInputs = (
  containerSpec: ComponentSpec,
  containerPosition: XYPosition,
  containerArguments: Record<string, ArgumentType>,
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
    const argumentValue = containerArguments[input.name];

    const hasExternalConnection =
      isTaskOutputArgument(argumentValue) ||
      isGraphInputArgument(argumentValue);

    if (hasExternalConnection) {
      return;
    }

    const position = calculateUnpackedPosition(
      input.annotations,
      containerPosition,
      containerCenter,
    );

    const inputWithValue = { ...input, value: argumentValue };

    const { spec, ioName } = addTask(
      "input",
      null,
      position,
      updatedSpec,
      inputWithValue,
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
  outputNodesConnectedToContainer: Record<string, TaskOutputArgument>,
  tasksConnectedDownstreamFromContainer: Record<
    string,
    Record<string, TaskOutputArgument>
  >,
): {
  spec: ComponentSpec;
  outputNameMap: Map<string, string>;
} => {
  let updatedSpec = componentSpec;
  const outputNameMap = new Map<string, string>();

  const containerCenter = calculateSpecCenter(containerSpec);

  const outputs = containerSpec.outputs;

  outputs?.forEach((output) => {
    const hasExternalConnection = isOutputConnectedExternally(
      output.name,
      outputNodesConnectedToContainer,
      tasksConnectedDownstreamFromContainer,
    );

    if (hasExternalConnection) {
      return;
    }

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
  outputNodesConnectedToContainer: Record<string, TaskOutputArgument>,
  tasksConnectedDownstreamFromContainer: Record<
    string,
    Record<string, TaskOutputArgument>
  >,
): ComponentSpec => {
  let updatedSpec = componentSpec;

  if (!isGraphImplementation(containerSpec.implementation)) {
    return updatedSpec;
  }

  const outputValues = containerSpec.implementation.graph.outputValues || {};

  Object.entries(outputValues).forEach(([outputName, outputValue]) => {
    if (isGraphImplementation(updatedSpec.implementation)) {
      const hasExternalConnection = isOutputConnectedExternally(
        outputName,
        outputNodesConnectedToContainer,
        tasksConnectedDownstreamFromContainer,
      );

      if (hasExternalConnection) {
        return;
      }

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

export const reconnectUpstreamInputsAndTasks = (
  graphSpec: GraphSpec,
  taskId: string,
  originalGraphSpec: GraphSpec,
  componentSpec: ComponentSpec,
  taskIdMap: Map<string, string>,
): ComponentSpec => {
  let updatedSpec = deepClone(componentSpec);

  const argumentsWithConnections = getArgumentsWithUpstreamConnections(
    taskId,
    originalGraphSpec,
  );

  Object.entries(argumentsWithConnections).forEach(([inputName, argValue]) => {
    Object.entries(graphSpec.tasks).forEach(
      ([internalTaskId, internalTask]) => {
        if (!isGraphImplementation(updatedSpec.implementation)) {
          return;
        }

        if (!internalTask.arguments) {
          return;
        }

        const taskUsesThisInput = Object.entries(internalTask.arguments).some(
          ([_, argVal]) =>
            isGraphInputArgument(argVal) &&
            argVal.graphInput.inputName === inputName,
        );

        if (!taskUsesThisInput) {
          return;
        }

        Object.entries(internalTask.arguments).forEach(
          ([paramName, argVal]) => {
            if (
              !isGraphInputArgument(argVal) ||
              argVal.graphInput.inputName !== inputName ||
              !isGraphImplementation(updatedSpec.implementation)
            ) {
              return;
            }

            const remappedTaskId =
              taskIdMap.get(internalTaskId) || internalTaskId;

            const updatedGraphSpec = setTaskArgument(
              updatedSpec.implementation.graph,
              remappedTaskId,
              paramName,
              argValue,
            );

            updatedSpec = {
              ...updatedSpec,
              implementation: {
                ...updatedSpec.implementation,
                graph: updatedGraphSpec,
              },
            };
          },
        );
      },
    );
  });

  return updatedSpec;
};

export const reconnectDownstreamOutputs = (
  graphSpec: GraphSpec,
  taskId: string,
  originalGraphSpec: GraphSpec,
  componentSpec: ComponentSpec,
  taskIdMap: Map<string, string>,
): ComponentSpec => {
  let updatedSpec = componentSpec;

  const outputNodesConnectedToSubgraph = getOutputNodesConnectedToTask(
    taskId,
    originalGraphSpec,
  );

  const outputValues = graphSpec.outputValues || {};

  Object.entries(outputNodesConnectedToSubgraph).forEach(
    ([outputName, oldOutputValue]) => {
      Object.entries(outputValues).forEach(
        ([internalOutputName, internalOutputValue]) => {
          if (internalOutputName !== oldOutputValue.taskOutput.outputName) {
            return;
          }

          if (!isGraphImplementation(updatedSpec.implementation)) {
            return;
          }

          const remappedOutputValue = remapTaskOutputArgument(
            internalOutputValue,
            taskIdMap,
          );

          const updatedGraphSpec = setGraphOutputValue(
            updatedSpec.implementation.graph,
            outputName,
            remappedOutputValue,
          );

          updatedSpec = {
            ...updatedSpec,
            implementation: {
              ...updatedSpec.implementation,
              graph: updatedGraphSpec,
            },
          };
        },
      );
    },
  );

  return updatedSpec;
};

export const reconnectDownstreamTasks = (
  graphSpec: GraphSpec,
  taskId: string,
  originalGraphSpec: GraphSpec,
  componentSpec: ComponentSpec,
  taskIdMap: Map<string, string>,
): ComponentSpec => {
  let updatedSpec = componentSpec;

  const tasksConnectedDownstream = getDownstreamTaskNodesConnectedToTask(
    taskId,
    originalGraphSpec,
  );

  const outputValues = graphSpec.outputValues || {};

  Object.entries(tasksConnectedDownstream).forEach(
    ([downstreamTaskId, connectedArgs]) => {
      Object.entries(connectedArgs).forEach(([argName, oldArgValue]) => {
        if (!isGraphImplementation(updatedSpec.implementation)) {
          return;
        }

        const newArgValue = Object.entries(outputValues).find(
          ([outputName]) => outputName === oldArgValue.taskOutput.outputName,
        )?.[1];

        if (!newArgValue) {
          return;
        }

        const remappedArgValue = remapTaskOutputArgument(
          newArgValue,
          taskIdMap,
        );

        const updatedGraphSpec = setTaskArgument(
          updatedSpec.implementation.graph,
          downstreamTaskId,
          argName,
          remappedArgValue,
        );

        updatedSpec = {
          ...updatedSpec,
          implementation: {
            ...updatedSpec.implementation,
            graph: updatedGraphSpec,
          },
        };
      });
    },
  );

  return updatedSpec;
};

const isOutputConnectedExternally = (
  outputName: string,
  outputNodesConnectedToContainer: Record<string, TaskOutputArgument>,
  tasksConnectedDownstreamFromContainer: Record<
    string,
    Record<string, TaskOutputArgument>
  >,
): boolean => {
  const connectedToGraphOutput = Object.values(
    outputNodesConnectedToContainer,
  ).some((out) => out.taskOutput.outputName === outputName);

  const connectedToDownstreamTask = Object.values(
    tasksConnectedDownstreamFromContainer,
  ).some((connectedArgs) =>
    Object.values(connectedArgs).some(
      (arg) => arg.taskOutput.outputName === outputName,
    ),
  );

  return connectedToGraphOutput || connectedToDownstreamTask;
};
