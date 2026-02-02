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
import { ROOT_TASK_ID } from "./constants";

interface ValidationOptions {
  skipInputValueValidation?: boolean;
}

type ValidationIssueType = "graph" | "task" | "input" | "argument" | "output";

export interface ValidationError {
  type: ValidationIssueType;
  message: string;
  taskId?: string;
  inputName?: string;
  outputName?: string;
}

export function isFixableIssue(issue: ComponentValidationIssue): boolean {
  return issue.type === "argument";
}

export function validateArguments(
  inputs: InputSpec[],
  taskArguments: Record<string, string>,
): boolean {
  const normalizedValues = inputs
    .filter((input) => !input.optional)
    .map((input) =>
      String(
        taskArguments[input.name] || input.value || input.default || "",
      ).trim(),
    );
  return normalizedValues.every(Boolean);
}

export interface ComponentValidationIssue extends ValidationError {
  id: string;
  subgraphPath: string[];
}

export const checkComponentSpecValidity = (
  componentSpec: ComponentSpec,
  options?: ValidationOptions,
): { isValid: boolean; errors: ValidationError[] } => {
  const errors: ValidationError[] = [];
  const { skipInputValueValidation = false } = options ?? {};

  // Basic validation
  const basicErrors = validateBasicComponentSpec(componentSpec);
  errors.push(...basicErrors);

  if (
    basicErrors.length > 0 &&
    basicErrors.some(
      (e) => e.message.includes("null") || e.message.includes("implementation"),
    )
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
  errors.push(...validateGraphTasks(graphSpec, componentSpec));
  errors.push(...validateGraphOutputs(graphSpec, componentSpec));
  errors.push(...validateInputOutputConnections(graphSpec, componentSpec));
  errors.push(...validateCircularDependencies(graphSpec));

  return { isValid: errors.length === 0, errors };
};

const validateBasicComponentSpec = (
  componentSpec: ComponentSpec,
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Basic null/undefined check
  if (!componentSpec) {
    errors.push({
      type: "graph",
      message: "Component spec is null or undefined",
    });
    return errors;
  }

  // Validate component name
  if (!componentSpec.name || componentSpec.name.trim() === "") {
    errors.push({
      type: "graph",
      message: "Component name is required and cannot be empty",
    });
  }

  // Validate implementation exists
  if (!componentSpec.implementation) {
    errors.push({
      type: "graph",
      message: "Component implementation is required",
    });
  }

  return errors;
};

const validateInputsAndOutputs = (
  componentSpec: ComponentSpec,
  skipInputValueValidation: boolean,
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Validate inputs array structure
  if (componentSpec.inputs) {
    const inputNames = new Set<string>();
    componentSpec.inputs.forEach((input) => {
      // Check input name is required
      if (!input.name || input.name.trim() === "") {
        errors.push({
          type: "input",
          message: `Input with value "${input.value}" must have a valid name`,
        });
      } else {
        // Check for duplicate input names
        if (inputNames.has(input.name)) {
          errors.push({
            type: "input",
            message: `Duplicate input name: "${input.name}"`,
            inputName: input.name,
          });
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
        errors.push({
          type: "argument",
          message: `Required input missing value`,
          inputName: input.name,
        });
      }
    });
  }

  // Validate outputs array structure
  if (componentSpec.outputs) {
    const outputNames = new Set<string>();
    componentSpec.outputs.forEach((output) => {
      // Check output name is required
      if (!output.name || output.name.trim() === "") {
        errors.push({
          type: "output",
          message: `Output with type "${output.type}" must have a valid name`,
        });
      } else {
        // Check for duplicate output names
        if (outputNames.has(output.name)) {
          errors.push({
            type: "output",
            message: `Duplicate output name: "${output.name}"`,
            outputName: output.name,
          });
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
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Validate graph tasks exist
  if (!graphSpec.tasks || Object.keys(graphSpec.tasks).length === 0) {
    errors.push({
      type: "graph",
      message: "Pipeline must contain at least one task",
    });
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
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Check task ID is valid
  if (!taskId || taskId.trim() === "") {
    errors.push({ type: "task", message: "Task ID cannot be empty" });
  }

  // Validate task has component reference
  if (!task.componentRef) {
    errors.push({
      type: "task",
      message: "Missing componentRef",
      taskId,
    });
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
): ValidationError[] => {
  const errors: ValidationError[] = [];

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
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const inputName = argValue.graphInput.inputName;
  const componentInput = componentSpec.inputs?.find(
    (i) => i.name === inputName,
  );

  if (!componentInput) {
    errors.push({
      type: "task",
      message: `Argument "${argName}" references non-existent input: "${inputName}"`,
      taskId,
    });
  }

  return errors;
};

const validateTaskOutputReference = (
  taskId: string,
  argName: string,
  argValue: TaskOutputArgument,
  graphSpec: GraphSpec,
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const referencedTaskId = argValue.taskOutput.taskId;
  const referencedOutput = argValue.taskOutput.outputName;

  if (!graphSpec.tasks[referencedTaskId]) {
    errors.push({
      type: "task",
      message: `Argument "${argName}" references non-existent task: "${referencedTaskId}"`,
      taskId,
    });
  } else {
    // Validate that the referenced output exists in the referenced task's component
    const referencedTask = graphSpec.tasks[referencedTaskId];
    if (referencedTask.componentRef && referencedTask.componentRef.spec) {
      const referencedTaskSpec = referencedTask.componentRef.spec;
      const outputExists = referencedTaskSpec.outputs?.some(
        (output: any) => output.name === referencedOutput,
      );

      if (!outputExists) {
        errors.push({
          type: "task",
          message: `Argument "${argName}" references non-existent output "${referencedOutput}" from task "${referencedTaskId}"`,
          taskId,
        });
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
): ValidationError[] => {
  const errors: ValidationError[] = [];

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
          errors.push({
            type: "task",
            message: `Missing input "${input.name}"`,
            taskId,
          });
        }
      }
    });
  }

  return errors;
};

const validateGraphOutputs = (
  graphSpec: GraphSpec,
  componentSpec: ComponentSpec,
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!graphSpec.outputValues) return errors;

  Object.entries(graphSpec.outputValues).forEach(
    ([outputName, outputValue]: [string, TaskOutputArgument]) => {
      // Check if output is defined in component outputs
      const componentOutput = componentSpec.outputs?.find(
        (o) => o.name === outputName,
      );
      if (!componentOutput) {
        errors.push({
          type: "output",
          message: `Not defined in component outputs`,
          outputName,
        });
      }

      // Check if referenced task exists
      const referencedTaskId = outputValue.taskOutput.taskId;
      if (!graphSpec.tasks[referencedTaskId]) {
        errors.push({
          type: "output",
          message: `References non-existent task: "${referencedTaskId}"`,
          outputName,
        });
      }
    },
  );

  return errors;
};

const validateInputOutputConnections = (
  graphSpec: GraphSpec,
  componentSpec: ComponentSpec,
): ValidationError[] => {
  const errors: ValidationError[] = [];

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

      if (!isInputUsed) {
        errors.push({
          type: "input",
          message: "Not connected to any tasks",
          inputName: input.name,
        });
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
        errors.push({
          type: "output",
          message: "Not connected to any tasks",
          outputName: output.name,
        });
      }
    });
  }

  return errors;
};

const validateCircularDependencies = (
  graphSpec: GraphSpec,
): ValidationError[] => {
  const errors: ValidationError[] = [];
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
      errors.push({
        type: "task",
        message: "Circular dependency detected",
        taskId,
      });
      break;
    }
  }

  return errors;
};

export const collectComponentValidationIssues = (
  componentSpec: ComponentSpec,
): ComponentValidationIssue[] => {
  return collectIssuesRecursive(componentSpec, {
    subgraphPath: [ROOT_TASK_ID],
    skipInputValueValidation: false,
    visitedSpecs: new Set(),
  });
};

interface ValidationContext {
  subgraphPath: string[];
  skipInputValueValidation: boolean;
  visitedSpecs: Set<ComponentSpec>;
}

const collectIssuesRecursive = (
  componentSpec: ComponentSpec,
  context: ValidationContext,
): ComponentValidationIssue[] => {
  if (context.visitedSpecs.has(componentSpec)) {
    return [];
  }
  context.visitedSpecs.add(componentSpec);

  const { subgraphPath } = context;
  const { errors } = checkComponentSpecValidity(componentSpec, {
    skipInputValueValidation: context.skipInputValueValidation,
  });

  const issuesForCurrent = errors.map((error, index) => ({
    id: buildIssueId(subgraphPath, error, index),
    subgraphPath,
    ...error,
  }));

  if (!isGraphImplementation(componentSpec.implementation)) {
    return issuesForCurrent;
  }

  const nestedIssues = Object.entries(
    componentSpec.implementation.graph.tasks,
  ).flatMap(([taskId, taskSpec]) => {
    const nestedSpec = taskSpec.componentRef?.spec;
    if (!nestedSpec || !isGraphImplementation(nestedSpec.implementation)) {
      return [];
    }

    return collectIssuesRecursive(nestedSpec, {
      subgraphPath: [...subgraphPath, taskId],
      skipInputValueValidation: true,
      visitedSpecs: context.visitedSpecs,
    });
  });

  return [...issuesForCurrent, ...nestedIssues];
};

const buildIssueId = (
  path: string[],
  error: ValidationError,
  index: number,
): string => {
  const targetKey =
    error.taskId ?? error.inputName ?? error.outputName ?? "graph";
  return `${path.join(">")}::${error.type}::${targetKey}::${index}`;
};
