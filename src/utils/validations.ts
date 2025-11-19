import type {
  ArgumentType,
  ComponentSpec,
  GraphInputArgument,
  GraphSpec,
  InputSpec,
  OutputSpec,
  TaskOutputArgument,
  TaskSpec,
} from "./componentSpec";
import {
  isGraphImplementation,
  isGraphInputArgument,
  isTaskOutputArgument,
} from "./componentSpec";
import type { NodePath } from "./nodeAnchors";
import { buildNodeAnchor, clonePath, ROOT_NODE_ANCHOR } from "./nodeAnchors";

export interface ValidationErrorDetail {
  path: NodePath;
  anchor: string;
  reason: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  nodeErrors: ValidationErrorDetail[];
}

interface ValidationOptions {
  skipInputValueValidation?: boolean;
  memo?: WeakMap<ComponentSpec, Map<string, ValidationResult>>;
  inProgress?: WeakMap<ComponentSpec, Set<string>>;
}

const recordNodeError = (
  nodeErrors: ValidationErrorDetail[],
  path: NodePath,
  message: string,
): void => {
  const frozenPath = clonePath(path);

  nodeErrors.push({
    reason: message,
    path: frozenPath,
    anchor: buildNodeAnchor(frozenPath),
  });
};

const pushPipelineError = (
  errors: string[],
  nodeErrors: ValidationErrorDetail[],
  message: string,
): void => {
  errors.push(message);
  recordNodeError(nodeErrors, [], message);
};

interface PushOptions {
  record?: boolean;
}

const pushTaskError = (
  errors: string[],
  nodeErrors: ValidationErrorDetail[],
  pathStack: NodePath,
  message: string,
  options?: PushOptions,
): void => {
  errors.push(message);
  if (options?.record === false) {
    return;
  }
  recordNodeError(nodeErrors, pathStack, message);
};

const pushPathError = (
  errors: string[],
  nodeErrors: ValidationErrorDetail[],
  path: NodePath,
  message: string,
): void => {
  errors.push(message);
  recordNodeError(nodeErrors, path, message);
};

const mergeChildNodeErrors = (
  nodeErrors: ValidationErrorDetail[],
  childNodeErrors: ValidationErrorDetail[],
  parentPath: NodePath,
): void => {
  childNodeErrors.forEach((detail) => {
    const mergedPath =
      detail.path.length === 0
        ? clonePath(parentPath)
        : [...parentPath, ...detail.path];
    recordNodeError(nodeErrors, mergedPath, detail.reason);
  });
};

export const checkComponentSpecValidity = (
  componentSpec: ComponentSpec,
  options?: ValidationOptions,
): ValidationResult => {
  const errors: string[] = [];
  const nodeErrors: ValidationErrorDetail[] = [];
  const { skipInputValueValidation = false } = options ?? {};
  const memo =
    options?.memo ??
    new WeakMap<ComponentSpec, Map<string, ValidationResult>>();
  const inProgress =
    options?.inProgress ?? new WeakMap<ComponentSpec, Set<string>>();
  const memoKey = skipInputValueValidation ? "skipInputs" : "default";
  let cachedResult: ValidationResult | undefined;
  let activeProgressSet: Set<string> | undefined;

  if (componentSpec) {
    const cacheForSpec = memo.get(componentSpec);
    cachedResult = cacheForSpec?.get(memoKey);
    if (cachedResult) {
      return cachedResult;
    }

    const existingProgressSet = inProgress.get(componentSpec);
    if (existingProgressSet?.has(memoKey)) {
      return createCircularReferenceResult(componentSpec);
    }

    activeProgressSet = existingProgressSet ?? new Set();
    if (!existingProgressSet) {
      inProgress.set(componentSpec, activeProgressSet);
    }
    activeProgressSet.add(memoKey);
  }

  const releaseInProgress = (): void => {
    if (componentSpec && activeProgressSet) {
      activeProgressSet.delete(memoKey);
      if (activeProgressSet.size === 0) {
        inProgress.delete(componentSpec);
      }
    }
  };

  // Basic validation
  const basicErrors = validateBasicComponentSpec(componentSpec);
  basicErrors.forEach((message) =>
    pushPipelineError(errors, nodeErrors, message),
  );

  if (
    basicErrors.length > 0 &&
    basicErrors.some((e) => e.includes("null") || e.includes("implementation"))
  ) {
    releaseInProgress();
    return { isValid: false, errors, nodeErrors };
  }

  // Validate inputs and outputs
  const inputOutputErrors = validateInputsAndOutputs(
    componentSpec,
    skipInputValueValidation,
  );
  inputOutputErrors.forEach((message) =>
    pushPipelineError(errors, nodeErrors, message),
  );

  // Skip further validation for non-graph implementations
  if (!isGraphImplementation(componentSpec.implementation)) {
    console.warn(
      "Component implementation is not a graph. Skipping graph-specific validations.",
    );
    releaseInProgress();
    return { isValid: errors.length === 0, errors, nodeErrors };
  }

  // Graph-specific validations
  const graphSpec = componentSpec.implementation.graph;
  const pathStack: NodePath = [];
  errors.push(
    ...validateGraphTasks(
      graphSpec,
      componentSpec,
      {
        skipInputValueValidation,
        memo,
        inProgress,
      },
      nodeErrors,
      pathStack,
    ),
  );
  const graphOutputErrors = validateGraphOutputs(graphSpec, componentSpec);
  graphOutputErrors.forEach((message) =>
    pushPipelineError(errors, nodeErrors, message),
  );
  const ioConnectionErrors = validateInputOutputConnections(
    graphSpec,
    componentSpec,
  );
  ioConnectionErrors.forEach((message) =>
    pushPipelineError(errors, nodeErrors, message),
  );
  const circularDependencyErrors = validateCircularDependencies(
    graphSpec,
    nodeErrors,
  );
  errors.push(...circularDependencyErrors);

  const result = { isValid: errors.length === 0, errors, nodeErrors };

  if (componentSpec) {
    let cacheForSpec = memo.get(componentSpec);
    if (!cacheForSpec) {
      cacheForSpec = new Map();
      memo.set(componentSpec, cacheForSpec);
    }
    cacheForSpec.set(memoKey, result);
  }

  releaseInProgress();
  return result;
};

const validateBasicComponentSpec = (componentSpec: ComponentSpec): string[] => {
  const errors: string[] = [];

  // Basic null/undefined check
  if (!componentSpec) {
    errors.push("Component spec is null or undefined");
    return errors;
  }

  // Validate component name
  if (!componentSpec.name || componentSpec.name.trim() === "") {
    errors.push("Component name is required and cannot be empty");
  }

  // Validate implementation exists
  if (!componentSpec.implementation) {
    errors.push("Component implementation is required");
  }

  return errors;
};

const validateInputsAndOutputs = (
  componentSpec: ComponentSpec,
  skipInputValueValidation: boolean,
): string[] => {
  const errors: string[] = [];

  // Validate inputs array structure
  if (componentSpec.inputs) {
    const inputNames = new Set<string>();
    componentSpec.inputs.forEach((input) => {
      // Check input name is required
      if (!input.name || input.name.trim() === "") {
        errors.push(`Input with value "${input.value}" must have a valid name`);
      } else {
        // Check for duplicate input names
        if (inputNames.has(input.name)) {
          errors.push(`Duplicate input name found: "${input.name}"`);
        }
        inputNames.add(input.name);
      }

      // Check that required inputs have a value or default
      if (
        !skipInputValueValidation &&
        !input.optional &&
        !input.default &&
        !input.value
      ) {
        errors.push(
          `Pipeline input "${input.name}" is required and does not have a value`,
        );
      }
    });
  }

  // Validate outputs array structure
  if (componentSpec.outputs) {
    const outputNames = new Set<string>();
    componentSpec.outputs.forEach((output) => {
      // Check output name is required
      if (!output.name || output.name.trim() === "") {
        errors.push(`Output with type "${output.type}" must have a valid name`);
      } else {
        // Check for duplicate output names
        if (outputNames.has(output.name)) {
          errors.push(`Duplicate output name found: "${output.name}"`);
        }
        outputNames.add(output.name);
      }
    });
  }

  return errors;
};

const validateGraphTasks = (
  graphSpec: GraphSpec,
  componentSpec: ComponentSpec,
  options: ValidationOptions,
  nodeErrors: ValidationErrorDetail[],
  pathStack: NodePath,
): string[] => {
  const errors: string[] = [];

  // Validate graph tasks exist
  if (!graphSpec.tasks || Object.keys(graphSpec.tasks).length === 0) {
    pushPipelineError(
      errors,
      nodeErrors,
      "Pipeline must contain at least one task",
    );
    return errors;
  }

  // Validate task structure and names
  Object.entries(graphSpec.tasks).forEach(
    ([taskId, task]: [string, TaskSpec]) => {
      pathStack.push(taskId);
      errors.push(
        ...validateSingleTask(
          taskId,
          task,
          graphSpec,
          componentSpec,
          options,
          nodeErrors,
          pathStack,
        ),
      );
      pathStack.pop();
    },
  );

  return errors;
};

const validateSingleTask = (
  taskId: string,
  task: TaskSpec,
  graphSpec: GraphSpec,
  componentSpec: ComponentSpec,
  options: ValidationOptions,
  nodeErrors: ValidationErrorDetail[],
  pathStack: NodePath,
): string[] => {
  const errors: string[] = [];

  // Check task ID is valid
  if (!taskId || taskId.trim() === "") {
    pushTaskError(errors, nodeErrors, pathStack, "Task ID cannot be empty");
  }

  // Validate task has component reference
  if (!task.componentRef) {
    pushTaskError(
      errors,
      nodeErrors,
      pathStack,
      `Task "${taskId}" must have a componentRef`,
    );
  }

  // Validate task arguments
  errors.push(
    ...validateTaskArguments(
      taskId,
      task,
      graphSpec,
      componentSpec,
      nodeErrors,
      pathStack,
    ),
  );

  // Validate required inputs
  errors.push(
    ...validateTaskRequiredInputs(taskId, task, nodeErrors, pathStack),
  );

  const subgraphSpec = task.componentRef?.spec;
  const subgraphImplementation = subgraphSpec?.implementation;

  if (
    subgraphSpec &&
    subgraphImplementation &&
    isGraphImplementation(subgraphImplementation)
  ) {
    const subgraphResult = checkComponentSpecValidity(subgraphSpec, {
      skipInputValueValidation: true,
      memo: options.memo,
      inProgress: options.inProgress,
    });

    if (!subgraphResult.isValid) {
      if (subgraphResult.errors.length === 0) {
        const message = formatSubgraphErrorMessage(taskId);
        pushTaskError(errors, nodeErrors, pathStack, message, {
          record: false,
        });
      } else {
        subgraphResult.errors.forEach((subgraphError) => {
          const message = formatSubgraphErrorMessage(taskId, subgraphError);
          pushTaskError(errors, nodeErrors, pathStack, message, {
            record: false,
          });
        });
      }

      mergeChildNodeErrors(nodeErrors, subgraphResult.nodeErrors, pathStack);
    }
  }

  return errors;
};

const validateTaskArguments = (
  taskId: string,
  task: TaskSpec,
  graphSpec: GraphSpec,
  componentSpec: ComponentSpec,
  nodeErrors: ValidationErrorDetail[],
  pathStack: NodePath,
): string[] => {
  const errors: string[] = [];

  if (!task.arguments) return errors;

  Object.entries(task.arguments).forEach(
    ([argName, argValue]: [string, ArgumentType]) => {
      if (typeof argValue === "object" && argValue !== null) {
        // Check graphInput references
        if ("graphInput" in argValue) {
          errors.push(
            ...validateGraphInputReference(
              taskId,
              argName,
              argValue,
              componentSpec,
              nodeErrors,
              pathStack,
            ),
          );
        }

        // Check taskOutput references
        if ("taskOutput" in argValue) {
          errors.push(
            ...validateTaskOutputReference(
              taskId,
              argName,
              argValue,
              graphSpec,
              nodeErrors,
              pathStack,
            ),
          );
        }
      }
    },
  );

  return errors;
};

const validateGraphInputReference = (
  taskId: string,
  argName: string,
  argValue: GraphInputArgument,
  componentSpec: ComponentSpec,
  nodeErrors: ValidationErrorDetail[],
  pathStack: NodePath,
): string[] => {
  const errors: string[] = [];
  const inputName = argValue.graphInput.inputName;
  const componentInput = componentSpec.inputs?.find(
    (i) => i.name === inputName,
  );

  if (!componentInput) {
    pushTaskError(
      errors,
      nodeErrors,
      pathStack,
      `Task "${taskId}" argument "${argName}" references non-existent graph input: "${inputName}"`,
    );
  }

  return errors;
};

const validateTaskOutputReference = (
  taskId: string,
  argName: string,
  argValue: TaskOutputArgument,
  graphSpec: GraphSpec,
  nodeErrors: ValidationErrorDetail[],
  pathStack: NodePath,
): string[] => {
  const errors: string[] = [];
  const referencedTaskId = argValue.taskOutput.taskId;
  const referencedOutput = argValue.taskOutput.outputName;

  if (!graphSpec.tasks[referencedTaskId]) {
    pushTaskError(
      errors,
      nodeErrors,
      pathStack,
      `Task "${taskId}" argument "${argName}" references non-existent task: "${referencedTaskId}"`,
    );
  } else {
    // Validate that the referenced output exists in the referenced task's component
    const referencedTask = graphSpec.tasks[referencedTaskId];
    if (referencedTask.componentRef && referencedTask.componentRef.spec) {
      const referencedTaskSpec = referencedTask.componentRef.spec;
      const outputExists = referencedTaskSpec.outputs?.some(
        (output: OutputSpec) => output.name === referencedOutput,
      );

      if (!outputExists) {
        pushTaskError(
          errors,
          nodeErrors,
          pathStack,
          `Task "${taskId}" argument "${argName}" references non-existent output "${referencedOutput}" from task "${referencedTaskId}"`,
        );
      }
    } else {
      console.warn(
        `Cannot validate output "${referencedOutput}" for task "${referencedTaskId}" - component spec not loaded`,
      );
    }
  }

  return errors;
};

const validateTaskRequiredInputs = (
  taskId: string,
  task: TaskSpec,
  nodeErrors: ValidationErrorDetail[],
  pathStack: NodePath,
): string[] => {
  const errors: string[] = [];

  if (!task.componentRef || !task.componentRef.spec) {
    console.warn(
      `Cannot validate required inputs for task "${taskId}" - component spec not loaded`,
    );
    return errors;
  }

  const taskComponentSpec = task.componentRef.spec;

  if (taskComponentSpec.inputs) {
    taskComponentSpec.inputs.forEach((input: InputSpec) => {
      // Check if this input is required (not optional and no default value)
      const isRequired = !input.optional && !input.default;

      if (isRequired) {
        // Check if this required input has a value in task arguments
        const hasArgument =
          task.arguments &&
          Object.prototype.hasOwnProperty.call(task.arguments, input.name);

        if (!hasArgument) {
          pushTaskError(
            errors,
            nodeErrors,
            pathStack,
            `Task "${taskId}" is missing required argument for input: "${input.name}"`,
          );
        }
      }
    });
  }

  return errors;
};

const formatSubgraphErrorMessage = (
  taskId: string,
  detail?: string,
): string => {
  if (detail) {
    return `Task "${taskId}" subgraph: ${detail}`;
  }
  return `Task "${taskId}" contains validation errors in its subgraph`;
};

const formatCircularReferenceError = (componentSpec: ComponentSpec): string => {
  const componentName = componentSpec?.name ?? "Unnamed component";
  return `Component "${componentName}" contains circular subgraph references`;
};

const createCircularReferenceResult = (
  componentSpec: ComponentSpec,
): ValidationResult => {
  const message = formatCircularReferenceError(componentSpec);
  const nodeErrors: ValidationErrorDetail[] = [
    {
      reason: message,
      path: [],
      anchor: ROOT_NODE_ANCHOR,
    },
  ];

  return {
    isValid: false,
    errors: [message],
    nodeErrors,
  };
};

const validateGraphOutputs = (
  graphSpec: GraphSpec,
  componentSpec: ComponentSpec,
): string[] => {
  const errors: string[] = [];

  if (!graphSpec.outputValues) return errors;

  Object.entries(graphSpec.outputValues).forEach(
    ([outputName, outputValue]: [string, TaskOutputArgument]) => {
      // Check if output is defined in component outputs
      const componentOutput = componentSpec.outputs?.find(
        (o) => o.name === outputName,
      );
      if (!componentOutput) {
        errors.push(
          `Graph output "${outputName}" is not defined in component outputs`,
        );
      }

      // Check if referenced task exists
      const referencedTaskId = outputValue.taskOutput.taskId;
      if (!graphSpec.tasks[referencedTaskId]) {
        errors.push(
          `Graph output "${outputName}" references non-existent task: "${referencedTaskId}"`,
        );
      }
    },
  );

  return errors;
};

const validateInputOutputConnections = (
  graphSpec: GraphSpec,
  componentSpec: ComponentSpec,
): string[] => {
  const errors: string[] = [];

  // Validate all required component inputs have corresponding graph inputs or default values
  if (componentSpec.inputs) {
    componentSpec.inputs.forEach((input) => {
      // Check if this input is used in any task arguments
      const isInputUsed = Object.values(graphSpec.tasks).some(
        (task: TaskSpec) =>
          task.arguments &&
          Object.values(task.arguments).some(
            (arg: ArgumentType) =>
              isGraphInputArgument(arg) &&
              arg.graphInput.inputName === input.name,
          ),
      );

      if (!isInputUsed) {
        errors.push(
          `Pipeline input "${input.name}" is not connected to any tasks`,
        );
      }
    });
  }

  // Validate all component outputs are provided by graph outputs
  if (componentSpec.outputs) {
    componentSpec.outputs.forEach((output) => {
      const hasGraphOutput =
        graphSpec.outputValues &&
        Object.prototype.hasOwnProperty.call(
          graphSpec.outputValues,
          output.name,
        );

      if (!hasGraphOutput) {
        errors.push(
          `Pipeline output "${output.name}" is not connected to any tasks`,
        );
      }
    });
  }

  return errors;
};

const validateCircularDependencies = (
  graphSpec: GraphSpec,
  nodeErrors: ValidationErrorDetail[],
): string[] => {
  const errors: string[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (taskId: string): boolean => {
    if (recursionStack.has(taskId)) {
      return true; // Found cycle
    }
    if (visited.has(taskId)) {
      return false; // Already processed
    }

    visited.add(taskId);
    recursionStack.add(taskId);

    const task = graphSpec.tasks[taskId];
    if (task?.arguments) {
      for (const argValue of Object.values(task.arguments)) {
        if (isTaskOutputArgument(argValue)) {
          const dependentTaskId = argValue.taskOutput.taskId;
          if (hasCycle(dependentTaskId)) {
            return true;
          }
        }
      }
    }

    recursionStack.delete(taskId);
    return false;
  };

  // Check for cycles starting from each task
  for (const taskId of Object.keys(graphSpec.tasks)) {
    if (!visited.has(taskId) && hasCycle(taskId)) {
      const message =
        "Circular dependency detected in pipeline at task: " + taskId;
      pushPathError(errors, nodeErrors, [taskId], message);
      break;
    }
  }

  return errors;
};
