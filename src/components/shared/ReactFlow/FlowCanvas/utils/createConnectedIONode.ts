import type { XYPosition } from "@xyflow/react";

import type { TaskType } from "@/types/taskNode";
import type {
  ComponentSpec,
  GraphSpec,
  TypeSpecType,
} from "@/utils/componentSpec";
import { isGraphImplementation } from "@/utils/componentSpec";
import {
  nodeIdToInputName,
  nodeIdToOutputName,
  nodeIdToTaskId,
} from "@/utils/nodes/nodeIdUtils";

import addTask from "./addTask";
import { setGraphOutputValue } from "./setGraphOutputValue";
import { setTaskArgument } from "./setTaskArgument";

const IO_NAME_SUFFIX: Record<"INPUT" | "OUTPUT", string> = {
  INPUT: " input",
  OUTPUT: " output",
};

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
  const argName =
    ioType === "input"
      ? nodeIdToInputName(handleId)
      : nodeIdToOutputName(handleId);
  const taskType: TaskType = ioType;
  const nameSuffix =
    ioType === "input" ? IO_NAME_SUFFIX.INPUT : IO_NAME_SUFFIX.OUTPUT;

  const taskSpec = componentSpec.implementation.graph.tasks[taskId];
  const taskComponentSpec = taskSpec?.componentRef?.spec;

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
      name: `${argName}${nameSuffix}`,
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
