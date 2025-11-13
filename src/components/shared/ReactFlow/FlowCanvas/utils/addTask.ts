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

const addTask = (
  taskType: TaskType,
  taskSpec: TaskSpec | null,
  position: XYPosition,
  componentSpec: ComponentSpec,
): { spec: ComponentSpec; taskId: string | undefined } => {
  const newComponentSpec = deepClone(componentSpec);
  let taskId: string | undefined;

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
      taskSpec.componentRef.spec?.inputs?.reduce(
        (acc, input) => {
          if (input.default) {
            acc[input.name] = input.default;
          }
          return acc;
        },
        {} as Record<string, string>,
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
    const inputId = getUniqueInputName(newComponentSpec);
    const inputSpec: InputSpec = {
      name: inputId,
      annotations: positionAnnotations,
    };
    const inputs = (newComponentSpec.inputs ?? []).concat([inputSpec]);

    newComponentSpec.inputs = inputs;
  }

  if (taskType === "output") {
    const outputId = getUniqueOutputName(newComponentSpec);
    const outputSpec: OutputSpec = {
      name: outputId,
      annotations: positionAnnotations,
    };

    const outputs = (newComponentSpec.outputs ?? []).concat([outputSpec]);

    newComponentSpec.outputs = outputs;
  }

  return { spec: newComponentSpec, taskId };
};

export default addTask;
