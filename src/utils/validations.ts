import {
  type ArgumentType,
  type ComponentSpec,
  type GraphInputArgument,
  type GraphSpec,
  type InputSpec,
  isGraphImplementation,
  type TaskOutputArgument,
  type TaskSpec,
} from "./componentSpec";

/**
 * Enhanced validation result with path information for nested components
 */
export interface ValidationError {
  path: string; // e.g., "Pipeline > Subgraph1 > Task2"
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Recursively validates the entire component tree including all nested subgraphs.
 * This is the main entry point for validation and should be used instead of
 * checkComponentSpecValidity for comprehensive validation.
 *
 * @param componentSpec - The root component spec to validate
 * @param componentName - Optional name for the root component (defaults to componentSpec.name)
 * @returns ValidationResult with all errors from the entire tree
 */
export const checkComponentSpecValidityRecursive = (
  componentSpec: ComponentSpec,
  componentName?: string,
): ValidationResult => {
  const allErrors: ValidationError[] = [];
  const rootName = componentName || componentSpec.name || "Pipeline";

  // Validate current level (isSubgraph = false for root)
  const currentLevelErrors = validateComponentSpecAtLevel(
    componentSpec,
    rootName,
    false, // Root pipeline is not a subgraph
  );
  allErrors.push(...currentLevelErrors);

  // If we have a graph implementation, recursively validate all subgraphs
  if (isGraphImplementation(componentSpec.implementation)) {
    const graphSpec = componentSpec.implementation.graph;
    if (graphSpec.tasks) {
      Object.entries(graphSpec.tasks).forEach(([taskId, task]) => {
        // Check if this task is a subgraph (has a graph implementation)
        if (
          task.componentRef?.spec &&
          isGraphImplementation(task.componentRef.spec.implementation)
        ) {
          const taskName = task.name || taskId;
          const subgraphPath = `${rootName} > ${taskName}`;

          // Validate that subgraph inputs are satisfied by task arguments
          const subgraphInputErrors = validateSubgraphInputs(
            task.componentRef.spec,
            task.arguments || {},
            subgraphPath,
          );
          allErrors.push(...subgraphInputErrors);

          // Recursively validate the subgraph (isSubgraph = true)
          const subgraphResult = checkComponentSpecValidityRecursive(
            task.componentRef.spec,
            subgraphPath,
          );
          // Filter out "required input" errors for subgraphs as we've already validated them above
          const filteredErrors = subgraphResult.errors.filter(
            (error) =>
              !error.message.includes("is required and does not have a value"),
          );
          allErrors.push(...filteredErrors);
        }
      });
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
};

/**
 * Validates a component spec at a single level (non-recursive).
 * Internal function used by checkComponentSpecValidityRecursive.
 *
 * @param componentSpec - The component spec to validate
 * @param path - The path to this component in the tree
 * @param isSubgraph - Whether this component is being used as a subgraph (inputs satisfied by parent arguments)
 * @returns Array of validation errors with path information
 */
const validateComponentSpecAtLevel = (
  componentSpec: ComponentSpec,
  path: string,
  isSubgraph: boolean = false,
): ValidationError[] => {
  const errors: string[] = [];

  // Basic validation
  const basicErrors = validateBasicComponentSpec(componentSpec);
  errors.push(...basicErrors);

  if (
    basicErrors.length > 0 &&
    basicErrors.some((e) => e.includes("null") || e.includes("implementation"))
  ) {
    return errors.map((message) => ({ path, message }));
  }

  // Validate inputs and outputs (skip input value validation for subgraphs)
  errors.push(...validateInputsAndOutputs(componentSpec, isSubgraph));

  // Skip further validation for non-graph implementations
  if (!isGraphImplementation(componentSpec.implementation)) {
    return errors.map((message) => ({ path, message }));
  }

  // Graph-specific validations
  const graphSpec = componentSpec.implementation.graph;
  errors.push(...validateGraphTasks(graphSpec, componentSpec));
  errors.push(...validateGraphOutputs(graphSpec, componentSpec));
  errors.push(...validateInputOutputConnections(graphSpec, componentSpec));
  errors.push(...validateCircularDependencies(graphSpec));

  return errors.map((message) => ({ path, message }));
};

/**
 * Legacy validation function for backwards compatibility.
 * Validates only the current level without recursing into subgraphs.
 *
 * @deprecated Use checkComponentSpecValidityRecursive for comprehensive validation
 */
export const checkComponentSpecValidity = (
  componentSpec: ComponentSpec,
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

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
  errors.push(...validateInputsAndOutputs(componentSpec));

  // Skip further validation for non-graph implementations
  if (!isGraphImplementation(componentSpec.implementation)) {
    console.warn(
      "Component implementation is not a graph. Skipping graph-specific validations.",
    );
    return { isValid: errors.length === 0, errors };
  }

  // Graph-specific validations
  const graphSpec = componentSpec.implementation.graph;
  errors.push(...validateGraphTasks(graphSpec, componentSpec));
  errors.push(...validateGraphOutputs(graphSpec, componentSpec));
  errors.push(...validateInputOutputConnections(graphSpec, componentSpec));
  errors.push(...validateCircularDependencies(graphSpec));

  return { isValid: errors.length === 0, errors };
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
  isSubgraph: boolean = false,
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

      // Only validate input values for root pipelines, not subgraphs
      // Subgraph inputs are satisfied by parent task arguments
      if (!isSubgraph) {
        // Check that required root pipeline inputs have a default (value is provided at runtime)
        if (!input.optional && !input.default && !input.value) {
          // This is only a warning for root pipelines since inputs can be provided at runtime
          // We don't error here as it's valid for a pipeline to require runtime inputs
        }
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

/**
 * Validates that all required inputs of a subgraph are satisfied by the parent task's arguments
 */
const validateSubgraphInputs = (
  subgraphSpec: ComponentSpec,
  taskArguments: Record<string, ArgumentType>,
  path: string,
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!subgraphSpec.inputs) {
    return errors;
  }

  subgraphSpec.inputs.forEach((input: InputSpec) => {
    const isRequired = !input.optional && !input.default && !input.value;

    if (isRequired) {
      // Check if this required input is provided in task arguments
      if (!taskArguments[input.name]) {
        errors.push({
          path,
          message: `Pipeline input "${input.name}" is required and does not have a value`,
        });
      }
    }

    // Check if the input is provided but not used by any task inside the subgraph
    if (taskArguments[input.name]) {
      // This is a valid scenario where an input is provided but may not be used
      // We could add a warning here, but it's not necessarily an error
      if (isGraphImplementation(subgraphSpec.implementation)) {
        const graphSpec = subgraphSpec.implementation.graph;
        const isUsed = Object.values(graphSpec.tasks || {}).some((task) =>
          Object.values(task.arguments || {}).some((arg) => {
            if (
              typeof arg === "object" &&
              arg !== null &&
              "graphInput" in arg
            ) {
              return (arg as GraphInputArgument).graphInput.inputName === input.name;
            }
            return false;
          }),
        );

        if (!isUsed && !input.optional) {
          errors.push({
            path,
            message: `Pipeline input "${input.name}" is not connected to any tasks`,
          });
        }
      }
    }
  });

  return errors;
};

const validateGraphTasks = (
  graphSpec: GraphSpec,
  componentSpec: ComponentSpec,
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
        ...validateSingleTask(taskId, task, graphSpec, componentSpec),
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
      if (typeof argValue === "object" && argValue !== null) {
        // Check graphInput references
        if ("graphInput" in argValue) {
          errors.push(
            ...validateGraphInputReference(
              taskId,
              argName,
              argValue,
              componentSpec,
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
        (output: any) => output.name === referencedOutput,
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
              typeof arg === "object" &&
              arg !== null &&
              "graphInput" in arg &&
              arg.graphInput.inputName === input.name,
          ),
      );

      // Only error if a REQUIRED (non-optional) input is not connected
      // Optional inputs can be provided but not used, which is fine
      if (!isInputUsed && !input.optional && !input.default) {
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
        if (
          typeof argValue === "object" &&
          argValue !== null &&
          "taskOutput" in argValue
        ) {
          const dependentTaskId = (argValue as any).taskOutput.taskId;
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
