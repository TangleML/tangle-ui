import type { XYPosition } from "@xyflow/react";

import type { TaskType } from "@/types/taskNode";
import {
  type ComponentSpec,
  type GraphSpec,
  type InputSpec,
  isGraphImplementation,
  type OutputSpec,
  type TaskSpec,
} from "@/utils/componentSpec";
import { deepClone } from "@/utils/deepClone";
import {
  getUniqueInputName,
  getUniqueOutputName,
  getUniqueTaskName,
} from "@/utils/unique";

interface AddTaskResult {
  spec: ComponentSpec;
  taskId: string | undefined;
  ioName?: string;
}

const addTask = (
  taskType: TaskType,
  taskSpec: TaskSpec | null,
  position: XYPosition,
  componentSpec: ComponentSpec,
  ioName?: string,
): AddTaskResult => {
  const newComponentSpec = deepClone(componentSpec);
  let taskId: string | undefined;
  let createdIOName: string | undefined;

  if (!isGraphImplementation(newComponentSpec.implementation)) {
    console.error("Implementation does not contain a graph.");
    return { spec: newComponentSpec, taskId };
  }
  const graphSpec = newComponentSpec.implementation.graph;

  const nodePosition = { x: position.x, y: position.y };
  const positionAnnotations = {
    "editor.position": JSON.stringify(nodePosition),
  };

  if (taskType === "task") {
    if (!taskSpec) {
      console.error("A taskSpec is required to create a task node.");
      return { spec: newComponentSpec, taskId };
    }

    const defaultArguments =
      taskSpec.componentRef.spec?.inputs?.reduce<Record<string, string>>(
        (acc, input) => {
          if (input.default) {
            acc[input.name] = input.default;
          }
          return acc;
        },
        {},
      ) ?? {};

    const mergedArguments = {
      ...defaultArguments,
      ...taskSpec.arguments,
    };

    const mergedAnnotations = {
      ...taskSpec.annotations,
      ...positionAnnotations,
    };

    const updatedTaskSpec: TaskSpec = {
      ...taskSpec,
      annotations: mergedAnnotations,
      arguments: mergedArguments,
    };

    taskId = getUniqueTaskName(
      graphSpec,
      taskSpec.componentRef.spec?.name ?? "Task",
    );

    const newGraphSpec: GraphSpec = {
      ...graphSpec,
      tasks: {
        ...graphSpec.tasks,
        [taskId]: updatedTaskSpec,
      },
    };

    newComponentSpec.implementation.graph = newGraphSpec;
  }

  if (taskType === "input") {
    const inputId = getUniqueInputName(newComponentSpec, ioName);
    const inputSpec: InputSpec = {
      name: inputId,
      annotations: positionAnnotations,
    };
    const inputs = (newComponentSpec.inputs ?? []).concat([inputSpec]);

    newComponentSpec.inputs = inputs;
    createdIOName = inputId;
  }

  if (taskType === "output") {
    const outputId = getUniqueOutputName(newComponentSpec, ioName);
    const outputSpec: OutputSpec = {
      name: outputId,
      annotations: positionAnnotations,
    };

    const outputs = (newComponentSpec.outputs ?? []).concat([outputSpec]);

    newComponentSpec.outputs = outputs;
    createdIOName = outputId;
  }

  return { spec: newComponentSpec, taskId, ioName: createdIOName };
};

export default addTask;
