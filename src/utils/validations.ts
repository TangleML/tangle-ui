import {
  type ArgumentType,
  type ComponentSpec,
  type GraphInputArgument,
  type GraphSpec,
  type InputSpec,
  isGraphImplementation,
  isGraphInputArgument,
  isTaskOutputArgument,
  type OutputSpec,
  type TaskOutputArgument,
  type TaskSpec,
} from "./componentSpec";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface ValidationOptions {
  skipInputValueValidation?: boolean;
  memo?: WeakMap<ComponentSpec, Map<string, ValidationResult>>;
}

export const checkComponentSpecValidity = (
  componentSpec: ComponentSpec,
  options?: ValidationOptions,
): ValidationResult => {
  const errors: string[] = [];
  const { skipInputValueValidation = false } = options ?? {};
  const memo =
    options?.memo ??
    new WeakMap<ComponentSpec, Map<string, ValidationResult>>();
  const memoKey = skipInputValueValidation ? "skipInputs" : "default";
  let cachedResult: ValidationResult | undefined;

  if (componentSpec) {
    const cacheForSpec = memo.get(componentSpec);
    cachedResult = cacheForSpec?.get(memoKey);
    if (cachedResult) {
      return cachedResult;
    }
  }

  // Basic validation
  const basicErrors = validateBasicComponentSpec(componentSpec);
  errors.push(...basicErrors);

  if (
    basicErrors.length > 0 &&
    basicErrors.some((e) => e.includes("null") || e.includes("implementation"))
  ) {
    return { isValid: false, errors };
  }

  // Validate inputs and outputs
  errors.push(
    ...validateInputsAndOutputs(componentSpec, skipInputValueValidation),
  );

  // Skip further validation for non-graph implementations
  if (!isGraphImplementation(componentSpec.implementation)) {
    console.warn(
      "Component implementation is not a graph. Skipping graph-specific validations.",
    );
    return { isValid: errors.length === 0, errors };
  }

  // Graph-specific validations
  const graphSpec = componentSpec.implementation.graph;
  errors.push(
    ...validateGraphTasks(graphSpec, componentSpec, {
      skipInputValueValidation,
      memo,
    }),
  );
  errors.push(...validateGraphOutputs(graphSpec, componentSpec));
  errors.push(...validateInputOutputConnections(graphSpec, componentSpec));
  errors.push(...validateCircularDependencies(graphSpec));

  const result = { isValid: errors.length === 0, errors };

  if (componentSpec) {
    let cacheForSpec = memo.get(componentSpec);
    if (!cacheForSpec) {
      cacheForSpec = new Map();
      memo.set(componentSpec, cacheForSpec);
    }
    cacheForSpec.set(memoKey, result);
  }

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
): string[] => {
  const errors: string[] = [];

  // Validate graph tasks exist
  if (!graphSpec.tasks || Object.keys(graphSpec.tasks).length === 0) {
    errors.push("Pipeline must contain at least one task");
    return errors;
  }

  // Validate task structure and names
  Object.entries(graphSpec.tasks).forEach(
    ([taskId, task]: [string, TaskSpec]) => {
      errors.push(
        ...validateSingleTask(taskId, task, graphSpec, componentSpec, options),
      );
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
): string[] => {
  const errors: string[] = [];

  // Check task ID is valid
  if (!taskId || taskId.trim() === "") {
    errors.push("Task ID cannot be empty");
  }

  // Validate task has component reference
  if (!task.componentRef) {
    errors.push(`Task "${taskId}" must have a componentRef`);
  }

  // Validate task arguments
  errors.push(...validateTaskArguments(taskId, task, graphSpec, componentSpec));

  // Validate required inputs
  errors.push(...validateTaskRequiredInputs(taskId, task));

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
    });

    if (!subgraphResult.isValid) {
      errors.push(formatSubgraphErrorMessage(taskId));
    }
  }

  return errors;
};

const validateTaskArguments = (
  taskId: string,
  task: TaskSpec,
  graphSpec: GraphSpec,
  componentSpec: ComponentSpec,
): string[] => {
  const errors: string[] = [];

  if (!task.arguments) return errors;

  Object.entries(task.arguments).forEach(
    ([argName, argValue]: [string, ArgumentType]) => {
      if (isGraphInputArgument(argValue)) {
        errors.push(
          ...validateGraphInputReference(
            taskId,
            argName,
            argValue,
            componentSpec,
          ),
        );
      }

      if (isTaskOutputArgument(argValue)) {
        errors.push(
          ...validateTaskOutputReference(taskId, argName, argValue, graphSpec),
        );
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
): string[] => {
  const errors: string[] = [];
  const inputName = argValue.graphInput.inputName;
  const componentInput = componentSpec.inputs?.find(
    (i) => i.name === inputName,
  );

  if (!componentInput) {
    errors.push(
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
): string[] => {
  const errors: string[] = [];
  const referencedTaskId = argValue.taskOutput.taskId;
  const referencedOutput = argValue.taskOutput.outputName;

  if (!graphSpec.tasks[referencedTaskId]) {
    errors.push(
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
        errors.push(
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
          errors.push(
            `Task "${taskId}" is missing required argument for input: "${input.name}"`,
          );
        }
      }
    });
  }

  return errors;
};

const formatSubgraphErrorMessage = (taskId: string): string => {
  return `Task "${taskId}" contains validation errors in its subgraph`;
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

const validateCircularDependencies = (graphSpec: GraphSpec): string[] => {
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
      errors.push(
        "Circular dependency detected in pipeline at task: " + taskId,
      );
      break;
    }
  }

  return errors;
};
