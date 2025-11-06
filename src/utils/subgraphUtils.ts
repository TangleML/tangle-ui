import type {
  ArgumentType,
  ComponentSpec,
  GraphInputArgument,
  GraphSpec,
  TaskOutputArgument,
  TaskSpec,
} from "./componentSpec";
import { isGraphImplementation, isTaskOutputArgument } from "./componentSpec";
import { ROOT_TASK_ID } from "./constants";
import { pluralize } from "./string";

type NotifyFunction = (
  message: string,
  type: "success" | "warning" | "error" | "info",
) => void;

/**
 * Determines if a task specification represents a subgraph (contains nested graph implementation)
 */
export const isSubgraph = (taskSpec: TaskSpec): boolean => {
  return Boolean(
    taskSpec.componentRef.spec &&
      isGraphImplementation(taskSpec.componentRef.spec.implementation),
  );
};

/**
 * Gets a human-readable description of the subgraph content
 */
export const getSubgraphDescription = (taskSpec: TaskSpec): string => {
  if (!isSubgraph(taskSpec)) {
    return "";
  }

  const subgraphSpec = taskSpec.componentRef.spec;
  if (!subgraphSpec || !isGraphImplementation(subgraphSpec.implementation)) {
    return "Empty subgraph";
  }

  const taskCount = Object.keys(subgraphSpec.implementation.graph.tasks).length;

  if (taskCount === 0) {
    return "Empty subgraph";
  }

  return `${taskCount} ${pluralize(taskCount, "task")}`;
};

/**
 * Navigates to a specific subgraph within a ComponentSpec based on a path
 * @param componentSpec - The root component specification
 * @param subgraphPath - Array of task IDs representing the path to the desired subgraph
 * @param notify - Optional notification function to display warnings
 * @returns ComponentSpec representing the subgraph, or the original spec if path is ["root"]
 */
export const getSubgraphComponentSpec = (
  componentSpec: ComponentSpec,
  subgraphPath: string[],
  notify?: NotifyFunction,
): ComponentSpec => {
  if (subgraphPath.length <= 1 || subgraphPath[0] !== ROOT_TASK_ID) {
    return componentSpec;
  }

  let currentSpec = componentSpec;

  for (let i = 1; i < subgraphPath.length; i++) {
    const taskId = subgraphPath[i];

    if (!isGraphImplementation(currentSpec.implementation)) {
      const message = `Cannot navigate to subgraph: current spec does not have graph implementation at path ${subgraphPath.slice(0, i + 1).join(".")}`;
      if (notify) {
        notify(message, "warning");
      } else {
        console.warn(message);
      }
      return componentSpec;
    }

    const task = currentSpec.implementation.graph.tasks[taskId];
    if (!task) {
      const message = `Cannot navigate to subgraph: task "${taskId}" not found at path ${subgraphPath.slice(0, i + 1).join(".")}`;
      if (notify) {
        notify(message, "warning");
      } else {
        console.warn(message);
      }
      return componentSpec;
    }

    if (!isSubgraph(task)) {
      const message = `Cannot navigate to subgraph: task "${taskId}" is not a subgraph at path ${subgraphPath.slice(0, i + 1).join(".")}`;
      if (notify) {
        notify(message, "warning");
      } else {
        console.warn(message);
      }
      return componentSpec;
    }

    if (!task.componentRef.spec) {
      const message = `Cannot navigate to subgraph: task "${taskId}" has no spec at path ${subgraphPath.slice(0, i + 1).join(".")}`;
      if (notify) {
        notify(message, "warning");
      } else {
        console.warn(message);
      }
      return componentSpec;
    }

    currentSpec = task.componentRef.spec;
  }

  return currentSpec;
};

const detectIONameChanges = (
  oldSpec: ComponentSpec,
  newSpec: ComponentSpec,
): {
  inputChanges: Map<string, string>;
  outputChanges: Map<string, string>;
} => {
  const inputChanges = new Map<string, string>();
  const outputChanges = new Map<string, string>();

  const oldInputs = oldSpec.inputs || [];
  const newInputs = newSpec.inputs || [];

  oldInputs.forEach((oldInput, index) => {
    const newInput = newInputs[index];
    if (
      newInput &&
      oldInput.name !== newInput.name &&
      oldInputs.length === newInputs.length
    ) {
      inputChanges.set(oldInput.name, newInput.name);
    }
  });

  const oldOutputs = oldSpec.outputs || [];
  const newOutputs = newSpec.outputs || [];

  oldOutputs.forEach((oldOutput, index) => {
    const newOutput = newOutputs[index];
    if (
      newOutput &&
      oldOutput.name !== newOutput.name &&
      oldOutputs.length === newOutputs.length
    ) {
      outputChanges.set(oldOutput.name, newOutput.name);
    }
  });

  return { inputChanges, outputChanges };
};

const updateTaskArgumentsForRenamedInputs = (
  taskSpec: TaskSpec,
  inputChanges: Map<string, string>,
): TaskSpec => {
  if (!taskSpec.arguments || inputChanges.size === 0) {
    return taskSpec;
  }

  const updatedArguments: Record<string, ArgumentType> = {};
  let hasChanges = false;

  Object.entries(taskSpec.arguments).forEach(([argName, argValue]) => {
    const newInputName = inputChanges.get(argName);

    if (newInputName) {
      updatedArguments[newInputName] = argValue;
      hasChanges = true;
    } else {
      updatedArguments[argName] = argValue;
    }

    if (
      argValue &&
      typeof argValue === "object" &&
      "graphInput" in argValue &&
      argValue.graphInput
    ) {
      const referencedInputName = argValue.graphInput.inputName;
      const newReferencedInputName = inputChanges.get(referencedInputName);

      if (newReferencedInputName) {
        updatedArguments[newInputName || argName] = {
          ...argValue,
          graphInput: {
            ...argValue.graphInput,
            inputName: newReferencedInputName,
          },
        } as GraphInputArgument;
        hasChanges = true;
      }
    }
  });

  return hasChanges ? { ...taskSpec, arguments: updatedArguments } : taskSpec;
};

/**
 * Updates task arguments that reference renamed outputs from a subgraph.
 * This ensures connections from subgraph outputs to other tasks remain valid.
 */
const updateTaskArgumentsForRenamedOutputs = (
  graphSpec: GraphSpec,
  subgraphTaskId: string,
  outputChanges: Map<string, string>,
): GraphSpec => {
  if (outputChanges.size === 0) {
    return graphSpec;
  }

  const updatedTasks: Record<string, TaskSpec> = {};
  let hasChanges = false;

  Object.entries(graphSpec.tasks).forEach(([taskId, taskSpec]) => {
    if (!taskSpec.arguments) {
      updatedTasks[taskId] = taskSpec;
      return;
    }

    const updatedArguments: Record<string, ArgumentType> = {};
    let taskHasChanges = false;

    Object.entries(taskSpec.arguments).forEach(([argName, argValue]) => {
      if (
        isTaskOutputArgument(argValue) &&
        argValue.taskOutput.taskId === subgraphTaskId
      ) {
        const oldOutputName = argValue.taskOutput.outputName;
        const newOutputName = outputChanges.get(oldOutputName);

        if (newOutputName) {
          updatedArguments[argName] = {
            ...argValue,
            taskOutput: {
              ...argValue.taskOutput,
              outputName: newOutputName,
            },
          };
          taskHasChanges = true;
        } else {
          updatedArguments[argName] = argValue;
        }
      } else {
        updatedArguments[argName] = argValue;
      }
    });

    if (taskHasChanges) {
      updatedTasks[taskId] = { ...taskSpec, arguments: updatedArguments };
      hasChanges = true;
    } else {
      updatedTasks[taskId] = taskSpec;
    }
  });

  return hasChanges ? { ...graphSpec, tasks: updatedTasks } : graphSpec;
};

/**
 * Updates the parent graph's output values when a subgraph's outputs are renamed.
 * This ensures that connections from subgraph outputs to parent outputs remain valid.
 */
const updateGraphOutputValuesForRenamedOutputs = (
  graphSpec: GraphSpec,
  subgraphTaskId: string,
  outputChanges: Map<string, string>,
): GraphSpec => {
  if (!graphSpec.outputValues || outputChanges.size === 0) {
    return graphSpec;
  }

  const updatedOutputValues: Record<string, TaskOutputArgument> = {};
  let hasChanges = false;

  Object.entries(graphSpec.outputValues).forEach(
    ([outputName, outputValue]) => {
      if (
        isTaskOutputArgument(outputValue) &&
        outputValue.taskOutput.taskId === subgraphTaskId
      ) {
        const oldOutputName = outputValue.taskOutput.outputName;
        const newOutputName = outputChanges.get(oldOutputName);

        if (newOutputName) {
          updatedOutputValues[outputName] = {
            ...outputValue,
            taskOutput: {
              ...outputValue.taskOutput,
              outputName: newOutputName,
            },
          };
          hasChanges = true;
        } else {
          updatedOutputValues[outputName] = outputValue;
        }
      } else {
        updatedOutputValues[outputName] = outputValue;
      }
    },
  );

  return hasChanges
    ? { ...graphSpec, outputValues: updatedOutputValues }
    : graphSpec;
};

/**
 * Updates a nested subgraph specification within the root component spec.
 * This function recursively navigates the subgraph path and replaces the
 * target subgraph's spec with the updated version, maintaining immutability
 * throughout the component tree.
 *
 * @param currentSpec - The component specification to update (root spec on initial call)
 * @param subgraphPath - Array of task IDs representing the path to the target subgraph (e.g., ["root", "task1", "task2"])
 * @param updatedSubgraphSpec - The new component spec for the target subgraph
 * @returns A new ComponentSpec with the subgraph updated
 *
 * @example
 * const newRootSpec = updateSubgraphSpec(
 *   rootSpec,
 *   ["root", "pipeline-task", "nested-task"],
 *   modifiedSubgraphSpec
 * );
 */
export const updateSubgraphSpec = (
  currentSpec: ComponentSpec,
  subgraphPath: string[],
  updatedSubgraphSpec: ComponentSpec,
): ComponentSpec => {
  const path =
    subgraphPath.length > 0 && subgraphPath[0] === ROOT_TASK_ID
      ? subgraphPath.slice(1)
      : subgraphPath;

  if (path.length === 0) {
    return updatedSubgraphSpec;
  }

  if (!isGraphImplementation(currentSpec.implementation)) {
    console.warn(
      `Cannot update subgraph: current spec does not have graph implementation`,
    );
    return currentSpec;
  }

  const taskId = path[0];
  const targetTask = currentSpec.implementation.graph.tasks[taskId];

  if (!targetTask) {
    console.warn(`Cannot update subgraph: task "${taskId}" not found`);
    return currentSpec;
  }

  if (!isSubgraph(targetTask)) {
    console.warn(`Cannot update subgraph: task "${taskId}" is not a subgraph`);
    return currentSpec;
  }

  if (!targetTask.componentRef.spec) {
    console.warn(`Cannot update subgraph: task "${taskId}" has no spec`);
    return currentSpec;
  }

  const oldSubgraphSpec = targetTask.componentRef.spec;
  const updatedNestedSpec = updateSubgraphSpec(
    oldSubgraphSpec,
    path.slice(1),
    updatedSubgraphSpec,
  );

  const { inputChanges, outputChanges } = detectIONameChanges(
    oldSubgraphSpec,
    updatedNestedSpec,
  );

  let updatedTargetTask = targetTask;
  if (inputChanges.size > 0) {
    updatedTargetTask = updateTaskArgumentsForRenamedInputs(
      targetTask,
      inputChanges,
    );
  }

  updatedTargetTask = {
    ...updatedTargetTask,
    componentRef: {
      ...updatedTargetTask.componentRef,
      spec: updatedNestedSpec,
    },
  };

  let updatedGraphSpec = currentSpec.implementation.graph;
  if (outputChanges.size > 0) {
    updatedGraphSpec = updateTaskArgumentsForRenamedOutputs(
      updatedGraphSpec,
      taskId,
      outputChanges,
    );
    updatedGraphSpec = updateGraphOutputValuesForRenamedOutputs(
      updatedGraphSpec,
      taskId,
      outputChanges,
    );
  }

  return {
    ...currentSpec,
    implementation: {
      ...currentSpec.implementation,
      graph: {
        ...updatedGraphSpec,
        tasks: {
          ...updatedGraphSpec.tasks,
          [taskId]: updatedTargetTask,
        },
      },
    },
  };
};
