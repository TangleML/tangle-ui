import type { XYPosition } from "@xyflow/react";

import type { TaskType } from "@/types/taskNode";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";
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

/**
 * Options for creating input/output nodes.
 * Omits position-related fields (annotations) which are automatically set.
 */
type IONodeOptions =
  | Omit<Partial<InputSpec>, "annotations">
  | Omit<Partial<OutputSpec>, "annotations">;

/**
 * Creates a task, input, or output node and adds it to the component specification.
 *
 * For task nodes: Creates a new task with the given spec and position.
 * For input/output nodes: Creates a new graph-level input or output with optional metadata.
 *
 * @param taskType - The type of node to create: "task", "input", or "output"
 * @param taskSpec - Required for task nodes (must not be null), null for input/output nodes
 * @param position - Canvas position {x, y} where the node should be visually placed
 * @param componentSpec - The component specification to modify (will be cloned, not mutated)
 * @param options - Partial InputSpec/OutputSpec fields (name, default, type, description, etc.)
 * @returns Object containing the updated spec, taskId (for tasks), and ioName (for inputs/outputs)
 *
 * @example
 * // Create a task node
 * const result = addTask("task", taskSpec, { x: 100, y: 200 }, componentSpec);
 *
 * @example
 * // Create an input node with default value
 * const result = addTask("input", null, { x: 50, y: 100 }, componentSpec, {
 *   name: "batch_size",
 *   default: "32",
 *   type: "Integer",
 *   description: "Number of samples per batch"
 * });
 */
const addTask = (
  taskType: TaskType,
  taskSpec: TaskSpec | null,
  position: XYPosition,
  componentSpec: ComponentSpec,
  options?: IONodeOptions,
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
    [EDITOR_POSITION_ANNOTATION]: JSON.stringify(nodePosition),
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
    const inputId = getUniqueInputName(newComponentSpec, options?.name);
    const inputSpec: InputSpec = {
      ...options,
      name: inputId,
      annotations: positionAnnotations,
    };

    const inputs = (newComponentSpec.inputs ?? []).concat([inputSpec]);
    newComponentSpec.inputs = inputs;
    createdIOName = inputId;
  }

  if (taskType === "output") {
    const outputId = getUniqueOutputName(newComponentSpec, options?.name);
    const outputSpec: OutputSpec = {
      ...options,
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
