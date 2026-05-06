import type { XYPosition } from "@xyflow/react";

import type { TaskType } from "@/types/taskNode";
import {
  AGGREGATOR_ADD_INPUT_HANDLE_ID,
  createAggregatorInput,
  getNextAggregatorInputName,
} from "@/utils/aggregatorInputs";
import { isPipelineAggregator } from "@/utils/annotations";
import type {
  ComponentReference,
  ComponentSpec,
  GraphSpec,
  TaskSpec,
  TypeSpecType,
} from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";
import {
  nodeIdToInputName,
  nodeIdToOutputName,
  nodeIdToTaskId,
} from "@/utils/nodes/nodeIdUtils";
import { componentSpecToText } from "@/utils/yaml";

import addTask from "./addTask";
import { setGraphOutputValue } from "./setGraphOutputValue";
import { setTaskArgument } from "./setTaskArgument";

type CreateConnectedIONodeParams = {
  componentSpec: ComponentSpec;
  taskNodeId: string;
  handleId: string;
  position: XYPosition;
  ioType: "input" | "output";
};

/**
 * Creates an input or output node and automatically connects it to a task's handle.
 *
 * This function:
 * 1. Creates a new input/output node with an auto-generated name (e.g., "param_name input")
 * 2. Adds it to the component spec at the specified position
 * 3. Copies default values from the task's input spec (for input nodes)
 * 4. Automatically wires the connection to the specified task handle
 *
 * For outputs: connects task output → graph output
 * For inputs: connects graph input → task input, preserving default values
 *
 * @param componentSpec - The component specification to modify
 * @param taskNodeId - The node ID of the task to connect to
 * @param handleId - The handle ID on the task (e.g., "input_param_name" or "output_result")
 * @param position - Where to place the new input/output node
 * @param ioType - Whether to create an "input" or "output" node
 * @returns Updated component spec with the new connected IO node
 */
export const createConnectedIONode = ({
  componentSpec,
  taskNodeId,
  handleId,
  position,
  ioType,
}: CreateConnectedIONodeParams): ComponentSpec => {
  if (!isGraphImplementation(componentSpec.implementation)) {
    return componentSpec;
  }

  const taskId = nodeIdToTaskId(taskNodeId);
  const taskSpec = componentSpec.implementation.graph.tasks[taskId];
  const taskComponentSpec = taskSpec?.componentRef?.spec;

  if (
    ioType === "input" &&
    handleId === AGGREGATOR_ADD_INPUT_HANDLE_ID &&
    taskSpec &&
    taskComponentSpec &&
    isPipelineAggregator(taskComponentSpec.metadata?.annotations)
  ) {
    return createConnectedAggregatorInputNode({
      componentSpec,
      taskId,
      taskSpec,
      taskComponentSpec,
      position,
    });
  }

  const argName =
    ioType === "input"
      ? nodeIdToInputName(handleId)
      : nodeIdToOutputName(handleId);
  const taskType: TaskType = ioType;

  let ioNodeType: TypeSpecType | undefined;
  let ioNodeDefault: string | undefined;

  if (ioType === "input") {
    const inputSpec = taskComponentSpec?.inputs?.find(
      (i) => i.name === argName,
    );
    ioNodeType = inputSpec?.type;
    const taskArgValue = taskSpec?.arguments?.[argName];
    ioNodeDefault =
      typeof taskArgValue === "string" ? taskArgValue : inputSpec?.default;
  } else {
    const outputSpec = taskComponentSpec?.outputs?.find(
      (o) => o.name === argName,
    );
    ioNodeType = outputSpec?.type;
  }

  const { spec: specWithIO, ioName: createdIOName } = addTask(
    taskType,
    null,
    position,
    componentSpec,
    {
      name: argName,
      type: ioNodeType,
      ...(ioNodeDefault && { default: ioNodeDefault }),
    },
  );

  if (!isGraphImplementation(specWithIO.implementation)) {
    return componentSpec;
  }

  if (!createdIOName) {
    return specWithIO;
  }

  let updatedGraph: GraphSpec;

  if (ioType === "output") {
    updatedGraph = setGraphOutputValue(
      specWithIO.implementation.graph,
      createdIOName,
      {
        taskOutput: {
          taskId,
          outputName: argName,
        },
      },
    );
  } else {
    updatedGraph = setTaskArgument(
      specWithIO.implementation.graph,
      taskId,
      argName,
      {
        graphInput: {
          inputName: createdIOName,
        },
      },
    );
  }

  return {
    ...specWithIO,
    implementation: {
      graph: updatedGraph,
    },
  };
};

type CreateConnectedAggregatorInputNodeParams = {
  componentSpec: ComponentSpec;
  taskId: string;
  taskSpec: TaskSpec;
  taskComponentSpec: ComponentSpec;
  position: XYPosition;
};

const createConnectedAggregatorInputNode = ({
  componentSpec,
  taskId,
  taskSpec,
  taskComponentSpec,
  position,
}: CreateConnectedAggregatorInputNodeParams): ComponentSpec => {
  const newAggInputName = getNextAggregatorInputName(
    taskComponentSpec.inputs ?? [],
  );
  const newAggInput = createAggregatorInput(newAggInputName);

  const clonedSpec: ComponentSpec = deepClone(taskComponentSpec);
  const updatedTaskInputs = [...(clonedSpec.inputs ?? []), newAggInput];

  const orderedTaskSpec: ComponentSpec = {
    name: clonedSpec.name,
    ...(clonedSpec.description && { description: clonedSpec.description }),
    ...(clonedSpec.metadata && { metadata: clonedSpec.metadata }),
    inputs: updatedTaskInputs,
    ...(clonedSpec.outputs && { outputs: clonedSpec.outputs }),
    implementation: clonedSpec.implementation,
  };

  const updatedComponentRef: ComponentReference = {
    ...taskSpec.componentRef,
    spec: orderedTaskSpec,
    text: componentSpecToText(orderedTaskSpec),
  };

  const specWithUpdatedTask = componentSpec;

  if (isGraphImplementation(specWithUpdatedTask.implementation)) {
    specWithUpdatedTask.implementation.graph.tasks[taskId] = {
      ...taskSpec,
      componentRef: updatedComponentRef,
    };
  }

  const { spec: specWithGraphInput, ioName: createdGraphInputName } = addTask(
    "input",
    null,
    position,
    specWithUpdatedTask,
    {
      name: newAggInputName,
      type: newAggInput.type,
    },
  );

  if (
    !createdGraphInputName ||
    !isGraphImplementation(specWithGraphInput.implementation)
  ) {
    return specWithGraphInput;
  }

  const updatedGraph = setTaskArgument(
    specWithGraphInput.implementation.graph,
    taskId,
    newAggInputName,
    { graphInput: { inputName: createdGraphInputName } },
  );

  return {
    ...specWithGraphInput,
    implementation: { graph: updatedGraph },
  };
};
