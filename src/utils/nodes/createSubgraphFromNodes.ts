import type { Node, XYPosition } from "@xyflow/react";

import {
  type Bounds,
  calculateNodesCenter,
  getNodesBounds,
  normalizeNodePosition,
} from "@/components/shared/ReactFlow/FlowCanvas/utils/geometry";
import { generateDigest, getComponentText } from "@/services/componentService";
import type {
  ArgumentType,
  ComponentSpec,
  GraphSpec,
  InputSpec,
  OutputSpec,
  TaskOutputArgument,
  TaskSpec,
  TypeSpecType,
} from "@/utils/componentSpec";
import {
  isGraphImplementation,
  isGraphInputArgument,
  isTaskOutputArgument,
} from "@/utils/componentSpec";

import { getUniqueName, getUniqueTaskName } from "../unique";
import { getUserDetails } from "../user";
import { extractPositionFromAnnotations } from "./extractPositionFromAnnotations";

// Arbitrary spacing parameters for layout of generated nodes
const GAP = 60;
const IO_NODE_WIDTH = 200;
const IO_NODE_HEIGHT = 100;
const IO_NODE_SPACING_X = IO_NODE_WIDTH + GAP;
const IO_NODE_SPACING_Y = IO_NODE_HEIGHT + GAP;

export const createSubgraphFromNodes = async (
  selectedNodes: Node[],
  currentComponentSpec: ComponentSpec,
  name?: string,
): Promise<TaskSpec> => {
  if (!isGraphImplementation(currentComponentSpec.implementation)) {
    throw new Error(
      "Current component spec does not have a graph implementation",
    );
  }

  const currentGraphSpec = currentComponentSpec.implementation.graph;

  const taskNodes = selectedNodes.filter((node) => node.type === "task");
  const inputNodes = selectedNodes.filter((node) => node.type === "input");
  const outputNodes = selectedNodes.filter((node) => node.type === "output");

  const subgraphTasks: Record<string, TaskSpec> = {};
  const subgraphInputs: InputSpec[] = [];
  const subgraphArguments: Record<string, ArgumentType> = {};
  const subgraphOutputs: OutputSpec[] = [];
  const subgraphOutputValues: Record<string, TaskOutputArgument> = {};

  const bounds = getNodesBounds(selectedNodes);

  // Copy selected tasks to subgraph and handle external connections
  taskNodes.forEach((node) => {
    const taskId = node.data.taskId as string;
    const originalTask = currentGraphSpec.tasks[taskId];

    if (!originalTask) return;

    const normalizedPosition = normalizeNodePosition(node, bounds);

    const updatedTaskArguments = processTaskInputConnections(
      originalTask,
      normalizedPosition,
      taskNodes,
      inputNodes,
      subgraphInputs,
      subgraphArguments,
      currentComponentSpec,
    );

    const normalizedPositionForOutputs = { ...normalizedPosition };
    normalizedPositionForOutputs.x += IO_NODE_WIDTH;
    if (node.measured?.height) {
      normalizedPositionForOutputs.y += node.measured?.height - IO_NODE_HEIGHT;
    }

    processTaskOutputConnections(
      originalTask,
      taskId,
      normalizedPositionForOutputs,
      taskNodes,
      outputNodes,
      subgraphOutputs,
      subgraphOutputValues,
      currentGraphSpec,
    );

    const newTask: TaskSpec = {
      ...originalTask,
      arguments: updatedTaskArguments,
      annotations: {
        ...originalTask.annotations,
        "editor.position": JSON.stringify(normalizedPosition),
      },
    };

    subgraphTasks[taskId] = newTask;
  });

  // Handle selected Input & Output Nodes
  processSelectedInputNodes(
    inputNodes,
    bounds,
    subgraphInputs,
    subgraphArguments,
    currentComponentSpec,
  );

  processSelectedOutputNodes(
    outputNodes,
    bounds,
    taskNodes,
    subgraphOutputs,
    subgraphOutputValues,
    currentGraphSpec,
  );

  // Create the replacement task that represents the subgraph
  const subgraphPosition = calculateNodesCenter(selectedNodes);

  const subgraphName =
    name ?? getUniqueTaskName(currentGraphSpec, "Generated Subgraph");

  const subgraphTask = await createSubgraphTask(
    subgraphName,
    subgraphInputs,
    subgraphOutputs,
    subgraphTasks,
    subgraphOutputValues,
    subgraphPosition,
    subgraphArguments,
  );

  const text = await getComponentText(subgraphTask.componentRef);
  if (text) {
    const subgraphDigest = await generateDigest(text);
    subgraphTask.componentRef.digest = subgraphDigest;
    subgraphTask.componentRef.text = text;
  }

  return subgraphTask;
};

const createSubgraphTask = async (
  name: string,
  inputs: InputSpec[],
  outputs: OutputSpec[],
  tasks: Record<string, TaskSpec>,
  outputValues: Record<string, TaskOutputArgument>,
  position: XYPosition,
  args: Record<string, ArgumentType>,
) => {
  let author: string = "Unknown";
  try {
    const userDetails = await getUserDetails();
    if (userDetails?.id) {
      author = userDetails.id;
    }
  } catch (error) {
    console.error("Error retrieving user details:", error);
  }

  const spec: ComponentSpec = {
    name,
    inputs,
    outputs,
    implementation: {
      graph: {
        tasks,
        outputValues,
      },
    },
    metadata: {
      annotations: {
        sdk: "https://cloud-pipelines.net/pipeline-editor/",
        "editor.flow-direction": "left-to-right",
        author,
      },
    },
  };

  const subgraphTask: TaskSpec = {
    componentRef: {
      spec,
      name,
    },
    annotations: {
      "editor.position": JSON.stringify(position),
    },
    arguments: args,
  };

  return subgraphTask;
};

const processSelectedInputNodes = (
  inputNodes: Node[],
  bounds: Bounds,
  subgraphInputs: InputSpec[],
  subgraphArguments: Record<string, ArgumentType>,
  currentComponentSpec: ComponentSpec,
): void => {
  inputNodes.forEach((node) => {
    const inputName = node.data.label as string | undefined;
    const inputType = node.data.type as TypeSpecType;
    const inputOptional = Boolean(node.data.optional);

    if (!inputName) return;

    const alreadyExists = subgraphInputs.some(
      (input) => input.name === inputName,
    );

    if (alreadyExists) return;

    const normalizedPosition = normalizeNodePosition(node, bounds);

    subgraphInputs.push({
      name: inputName,
      type: inputType,
      optional: inputOptional,
      annotations: {
        "editor.position": JSON.stringify(normalizedPosition),
      },
    });

    // Migrate the Input Node value to the subgraph arguments
    const originalInputSpec = currentComponentSpec.inputs?.find(
      (input) => input.name === inputName,
    );

    if (originalInputSpec?.value) {
      subgraphArguments[inputName] = originalInputSpec.value;
    }
  });
};

const processSelectedOutputNodes = (
  outputNodes: Node[],
  bounds: Bounds,
  taskNodes: Node[],
  subgraphOutputs: OutputSpec[],
  subgraphOutputValues: Record<string, TaskOutputArgument>,
  currentGraphSpec: GraphSpec,
): void => {
  outputNodes.forEach((node) => {
    const outputName = node.data.label as string | undefined;
    const outputType = node.data.type as TypeSpecType;

    if (!outputName) return;

    const alreadyExists = subgraphOutputs.some(
      (output) => output.name === outputName,
    );

    if (alreadyExists) return;

    const normalizedPosition = normalizeNodePosition(node, bounds);

    subgraphOutputs.push({
      name: outputName,
      type: outputType,
      annotations: {
        "editor.position": JSON.stringify(normalizedPosition),
      },
    });

    // Find the corresponding output value
    const outputValue = currentGraphSpec.outputValues?.[outputName];
    if (
      outputValue &&
      taskNodes.some(
        (node) => node.data.taskId === outputValue.taskOutput.taskId,
      )
    ) {
      subgraphOutputValues[outputName] = outputValue;
    }
  });
};

const processTaskInputConnections = (
  taskSpec: TaskSpec,
  taskPosition: XYPosition,
  selectedTaskNodes: Node[],
  selectedInputNodes: Node[],
  subgraphInputs: InputSpec[],
  subgraphArguments: Record<string, ArgumentType>,
  currentComponentSpec: ComponentSpec,
): Record<string, ArgumentType> => {
  if (!taskSpec.arguments) return {};

  if (!isGraphImplementation(currentComponentSpec.implementation)) {
    return {};
  }

  const currentGraphSpec = currentComponentSpec.implementation.graph;

  let externalInputCount = 0;
  const updatedArguments: Record<string, ArgumentType> = {};

  const selectedInputNames = new Set(
    selectedInputNodes.map((node) => node.data.label as string).filter(Boolean),
  );

  Object.entries(taskSpec.arguments).forEach(([argName, argValue]) => {
    let name: string = argName;
    let type: TypeSpecType = "Any";
    let isExternal = false;

    if (isTaskOutputArgument(argValue)) {
      const sourceTask = currentGraphSpec.tasks[argValue.taskOutput.taskId];
      const sourceOutputSpec = sourceTask?.componentRef?.spec?.outputs?.find(
        (output) => output.name === argValue.taskOutput.outputName,
      );

      name = argValue.taskOutput.outputName.replace(/_/g, " ");
      type = sourceOutputSpec?.type || "Any";
      isExternal = !selectedTaskNodes.some(
        (node) => node.data.taskId === argValue.taskOutput.taskId,
      );
    } else if (isGraphInputArgument(argValue)) {
      const currentInputSpec = currentComponentSpec.inputs?.find(
        (input) => input.name === argValue.graphInput.inputName,
      );

      name = argValue.graphInput.inputName;
      type = currentInputSpec?.type || "Any";
      isExternal = !selectedInputNodes.some((node) => node.data.label === name);
    }

    // Default case: retain existing argument
    updatedArguments[argName] = argValue;

    // Convert external input nodes & connections to subgraph inputs (internal input nodes & connections are retained as-is)
    if (isExternal) {
      const existingInput = subgraphInputs.find((input) => {
        const originalSource = subgraphArguments[input.name];
        return compareArguments(argValue, originalSource);
      });

      if (existingInput) {
        // If input already exists, move it to the top left of the group of relevant tasks
        const currentInputPosition = extractPositionFromAnnotations(
          existingInput.annotations,
        );

        const x = Math.min(
          taskPosition.x - IO_NODE_SPACING_X,
          currentInputPosition.x,
        );

        const y = Math.min(
          taskPosition.y + externalInputCount * IO_NODE_SPACING_Y,
          currentInputPosition.y,
        );

        existingInput.annotations = {
          ...existingInput.annotations,
          "editor.position": JSON.stringify({ x, y }),
        };

        updatedArguments[argName] = {
          graphInput: {
            inputName: existingInput.name,
            type: existingInput.type,
          },
        };
      } else {
        const existingInputNames = subgraphInputs.map((input) => input.name);
        const allReservedNames = [...existingInputNames, ...selectedInputNames];
        const displayName = getUniqueName(allReservedNames, name);

        const inputPosition = {
          x: taskPosition.x - IO_NODE_SPACING_X,
          y: taskPosition.y + externalInputCount * IO_NODE_SPACING_Y,
        };

        subgraphInputs.push({
          name: displayName,
          type,
          optional: false,
          annotations: {
            "editor.position": JSON.stringify(inputPosition),
          },
        });

        updatedArguments[argName] = {
          graphInput: {
            inputName: displayName,
            type,
          },
        };

        subgraphArguments[displayName] = argValue;
      }
      externalInputCount++;
    }
  });

  return updatedArguments;
};

const processTaskOutputConnections = (
  taskSpec: TaskSpec,
  taskId: string,
  taskPosition: XYPosition,
  selectedTasks: Node[],
  selectedOutputNodes: Node[],
  subgraphOutputs: OutputSpec[],
  subgraphOutputValues: Record<string, TaskOutputArgument>,
  currentGraphSpec: GraphSpec,
): void => {
  const taskOutputs = taskSpec.componentRef?.spec?.outputs || [];
  let externalOutputCount = 0;

  const selectedOutputNames = new Set(
    selectedOutputNodes
      .map((node) => node.data.label as string)
      .filter(Boolean),
  );

  taskOutputs.forEach((outputSpec) => {
    const outputName = outputSpec.name;
    const type = outputSpec.type || "string";

    // Mock this node as an Output Argument to compare against
    const mockOutputArg = {
      taskOutput: {
        taskId,
        outputName,
        type,
      },
    };

    const isConsumedByExternalTasks = Object.entries(
      currentGraphSpec.tasks,
    ).some(([externalTaskId, externalTask]) => {
      if (selectedTasks.some((node) => node.data.taskId === externalTaskId))
        return false;
      if (!externalTask.arguments) return false;

      return Object.values(externalTask.arguments).some((arg: ArgumentType) =>
        compareArguments(arg, mockOutputArg),
      );
    });

    const isConsumedByExternalOutputNodes = Object.entries(
      currentGraphSpec.outputValues ?? [],
    ).some(
      ([outputNodeName, outputValue]) =>
        compareArguments(outputValue, mockOutputArg) &&
        !selectedOutputNodes.some((node) => node.data.label === outputNodeName),
    );

    const isConsumedExternally =
      isConsumedByExternalTasks || isConsumedByExternalOutputNodes;

    if (isConsumedExternally) {
      const existingOutputNames = subgraphOutputs.map((output) => output.name);
      const allReservedNames = [...existingOutputNames, ...selectedOutputNames];
      const uniqueOutputName = getUniqueName(allReservedNames, outputName);
      const displayName = uniqueOutputName.replace(/_/g, " ");

      const outputPosition = {
        x: taskPosition.x + IO_NODE_SPACING_X,
        y: taskPosition.y + externalOutputCount * IO_NODE_SPACING_Y,
      };

      subgraphOutputs.push({
        name: displayName,
        type,
        annotations: {
          "editor.position": JSON.stringify(outputPosition),
        },
      });

      subgraphOutputValues[displayName] = {
        taskOutput: {
          taskId,
          outputName,
          type,
        },
      };

      externalOutputCount++;
    }
  });
};

const compareArguments = (
  argValue: ArgumentType,
  originalSource: ArgumentType,
): boolean => {
  if (isTaskOutputArgument(argValue)) {
    return (
      isTaskOutputArgument(originalSource) &&
      originalSource.taskOutput.taskId === argValue.taskOutput.taskId &&
      originalSource.taskOutput.outputName === argValue.taskOutput.outputName
    );
  } else if (isGraphInputArgument(argValue)) {
    return (
      isGraphInputArgument(originalSource) &&
      originalSource.graphInput.inputName === argValue.graphInput.inputName
    );
  }
  return false;
};
