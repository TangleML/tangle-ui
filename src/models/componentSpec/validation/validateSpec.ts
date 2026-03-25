import type { Binding } from "../entities/binding";
import type { ComponentSpec } from "../entities/componentSpec";
import type { Input } from "../entities/input";
import type { Output } from "../entities/output";
import type { Task } from "../entities/task";
import type { ComponentSpecJson, InputSpecJson } from "../entities/types";
import { isGraphInputArgument, isTaskOutputArgument } from "../entities/types";
import type { ValidationIssue } from "./types";

/**
 * Validate an entire ComponentSpec and return all issues.
 * This is the main entry point for CSOM validation.
 */
export function validateSpec(spec: ComponentSpec): ValidationIssue[] {
  return [
    ...validateGraphLevel(spec),
    ...validateInputs(spec),
    ...validateOutputs(spec),
    ...validateTasks(spec),
    ...validateBindings(spec),
    ...validateInputConnections(spec),
    ...validateOutputConnections(spec),
    ...validateCircularDependencies(spec),
  ];
}

// --- Graph-level rules ---

function validateGraphLevel(spec: ComponentSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!spec.name || spec.name.trim() === "") {
    issues.push({
      type: "graph",
      message: "Component name is required and cannot be empty",
      severity: "error",
      issueCode: "EMPTY_COMPONENT_NAME",
    });
  }

  if (spec.tasks.length === 0) {
    issues.push({
      type: "graph",
      message: "Pipeline must contain at least one task",
      severity: "error",
      issueCode: "NO_TASKS",
    });
  }

  return issues;
}

// --- Input rules ---

function validateInputs(spec: ComponentSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenNames = new Set<string>();

  for (const input of spec.inputs) {
    issues.push(...validateSingleInput(input, seenNames));
  }

  return issues;
}

function validateSingleInput(
  input: Input,
  seenNames: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!input.name || input.name.trim() === "") {
    issues.push({
      type: "input",
      message: "Input must have a valid name",
      entityId: input.$id,
      severity: "error",
      issueCode: "EMPTY_INPUT_NAME",
    });
  } else {
    if (seenNames.has(input.name)) {
      issues.push({
        type: "input",
        message: `Duplicate input name: "${input.name}"`,
        entityId: input.$id,
        severity: "error",
        issueCode: "DUPLICATE_INPUT_NAME",
        referencedName: input.name,
      });
    }
    seenNames.add(input.name);
  }

  return issues;
}

// --- Output rules ---

function validateOutputs(spec: ComponentSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenNames = new Set<string>();

  for (const output of spec.outputs) {
    issues.push(...validateSingleOutput(output, seenNames));
  }

  return issues;
}

function validateSingleOutput(
  output: Output,
  seenNames: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!output.name || output.name.trim() === "") {
    issues.push({
      type: "output",
      message: "Output must have a valid name",
      entityId: output.$id,
      severity: "error",
      issueCode: "EMPTY_OUTPUT_NAME",
    });
  } else {
    if (seenNames.has(output.name)) {
      issues.push({
        type: "output",
        message: `Duplicate output name: "${output.name}"`,
        entityId: output.$id,
        severity: "error",
        issueCode: "DUPLICATE_OUTPUT_NAME",
        referencedName: output.name,
      });
    }
    seenNames.add(output.name);
  }

  return issues;
}

// --- Task rules ---

function validateTasks(spec: ComponentSpec): ValidationIssue[] {
  return spec.tasks.flatMap((task) => validateSingleTask(task, spec));
}

function validateSingleTask(
  task: Task,
  spec: ComponentSpec,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!task.name || task.name.trim() === "") {
    issues.push({
      type: "task",
      message: "Task name cannot be empty",
      entityId: task.$id,
      severity: "error",
      issueCode: "EMPTY_TASK_NAME",
    });
  }

  if (!task.componentRef.name && !task.componentRef.url) {
    issues.push({
      type: "task",
      message: "Missing component reference",
      entityId: task.$id,
      severity: "error",
      issueCode: "MISSING_COMPONENT_REF",
    });
  }

  issues.push(...validateTaskArguments(task, spec));
  issues.push(...validateTaskRequiredInputs(task, spec));

  return issues;
}

/**
 * Validate that task argument references (graphInput / taskOutput) point to
 * entities that actually exist.
 */
function validateTaskArguments(
  task: Task,
  spec: ComponentSpec,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const arg of task.arguments) {
    if (!arg.value) continue;

    if (isGraphInputArgument(arg.value)) {
      const inputName = arg.value.graphInput.inputName;
      const inputExists = spec.inputs.some((i) => i.name === inputName);
      if (!inputExists) {
        issues.push({
          type: "task",
          message: `Argument "${arg.name}" references non-existent input: "${inputName}"`,
          entityId: task.$id,
          severity: "error",
          issueCode: "BAD_INPUT_REFERENCE",
          argumentName: arg.name,
          referencedName: inputName,
        });
      }
    }

    if (isTaskOutputArgument(arg.value)) {
      const refTaskName = arg.value.taskOutput.taskId;
      const refOutputName = arg.value.taskOutput.outputName;
      const refTask = spec.tasks.find((t) => t.name === refTaskName);

      if (!refTask) {
        issues.push({
          type: "task",
          message: `Argument "${arg.name}" references non-existent task: "${refTaskName}"`,
          entityId: task.$id,
          severity: "error",
          issueCode: "BAD_TASK_REFERENCE",
          argumentName: arg.name,
          referencedName: refTaskName,
        });
      } else if (refTask.componentRef.spec) {
        const refSpec = refTask.componentRef.spec as ComponentSpecJson;
        const outputExists = refSpec.outputs?.some(
          (o) => o.name === refOutputName,
        );
        if (!outputExists) {
          issues.push({
            type: "task",
            message: `Argument "${arg.name}" references non-existent output "${refOutputName}" from task "${refTaskName}"`,
            entityId: task.$id,
            severity: "error",
            issueCode: "BAD_OUTPUT_REFERENCE",
            argumentName: arg.name,
            referencedName: refOutputName,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check that all required inputs of a task's component spec are satisfied
 * by either a binding or an argument.
 */
function validateTaskRequiredInputs(
  task: Task,
  spec: ComponentSpec,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const taskSpec = task.componentRef.spec as ComponentSpecJson | undefined;

  if (!taskSpec?.inputs) return issues;

  const taskBindings = spec.bindings.filter(
    (b) => b.targetEntityId === task.$id,
  );

  for (const inputSpec of taskSpec.inputs) {
    if (isInputRequired(inputSpec)) {
      const hasBinding = taskBindings.some(
        (b) => b.targetPortName === inputSpec.name,
      );
      const hasArgument = task.arguments.some(
        (a) => a.name === inputSpec.name && a.value !== undefined,
      );

      if (!hasBinding && !hasArgument) {
        issues.push({
          type: "task",
          message: `Missing required input "${inputSpec.name}"`,
          entityId: task.$id,
          severity: "error",
          issueCode: "MISSING_REQUIRED_INPUT",
          argumentName: inputSpec.name,
        });
      }
    }
  }

  return issues;
}

export function isInputRequired(input: InputSpecJson): boolean {
  return !input.optional && !input.default;
}

// --- Binding rules ---

function validateBindings(spec: ComponentSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entityIds = new Set([
    ...spec.tasks.map((t) => t.$id),
    ...spec.inputs.map((i) => i.$id),
    ...spec.outputs.map((o) => o.$id),
  ]);

  for (const binding of spec.bindings) {
    issues.push(...validateSingleBinding(binding, entityIds));
  }

  return issues;
}

function validateSingleBinding(
  binding: Binding,
  validEntityIds: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!validEntityIds.has(binding.sourceEntityId)) {
    issues.push({
      type: "graph",
      message: `Binding references non-existent source entity: "${binding.sourceEntityId}"`,
      severity: "error",
      issueCode: "ORPHANED_BINDING_SOURCE",
      referencedName: binding.sourceEntityId,
      entityId: binding.$id,
    });
  }

  if (!validEntityIds.has(binding.targetEntityId)) {
    issues.push({
      type: "graph",
      message: `Binding references non-existent target entity: "${binding.targetEntityId}"`,
      severity: "error",
      issueCode: "ORPHANED_BINDING_TARGET",
      referencedName: binding.targetEntityId,
      entityId: binding.$id,
    });
  }

  return issues;
}

// --- Connection rules ---

/**
 * Each pipeline input should be connected to at least one task via a binding.
 */
function validateInputConnections(spec: ComponentSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const input of spec.inputs) {
    const isUsedByBinding = spec.bindings.some(
      (b) => b.sourceEntityId === input.$id,
    );
    const isUsedByArgument = spec.tasks.some((task) =>
      task.arguments.some(
        (arg) =>
          isGraphInputArgument(arg.value) &&
          arg.value.graphInput.inputName === input.name,
      ),
    );

    if (!isUsedByBinding && !isUsedByArgument) {
      issues.push({
        type: "input",
        message: "Not connected to any tasks",
        entityId: input.$id,
        severity: "warning",
        issueCode: "UNCONNECTED_INPUT",
      });
    }
  }

  return issues;
}

/**
 * Each pipeline output should be connected to a task via a binding.
 */
function validateOutputConnections(spec: ComponentSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const output of spec.outputs) {
    const hasBinding = spec.bindings.some(
      (b) => b.targetEntityId === output.$id,
    );

    if (!hasBinding) {
      issues.push({
        type: "output",
        message: "Not connected to any tasks",
        entityId: output.$id,
        severity: "warning",
        issueCode: "UNCONNECTED_OUTPUT",
      });
    }
  }

  return issues;
}

// --- Circular dependency detection ---

/**
 * Detect cycles in the task dependency graph built from bindings.
 * A dependency exists from task A to task B when a binding goes
 * from B (source) to A (target), meaning A depends on B's output.
 */
function validateCircularDependencies(spec: ComponentSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Build adjacency list: taskId -> set of taskIds it depends on
  const dependsOn = new Map<string, Set<string>>();
  for (const task of spec.tasks) {
    dependsOn.set(task.$id, new Set());
  }

  for (const binding of spec.bindings) {
    const sourceIsTask = spec.tasks.some(
      (t) => t.$id === binding.sourceEntityId,
    );
    const targetIsTask = spec.tasks.some(
      (t) => t.$id === binding.targetEntityId,
    );

    if (sourceIsTask && targetIsTask) {
      dependsOn.get(binding.targetEntityId)?.add(binding.sourceEntityId);
    }
  }

  // Also check task arguments for taskOutput references
  for (const task of spec.tasks) {
    for (const arg of task.arguments) {
      if (isTaskOutputArgument(arg.value)) {
        const refTaskId = arg.value.taskOutput.taskId;
        const depTask = spec.tasks.find((t) => t.name === refTaskId);
        if (depTask) {
          dependsOn.get(task.$id)?.add(depTask.$id);
        }
      }
    }
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (taskId: string): boolean => {
    if (recursionStack.has(taskId)) return true;
    if (visited.has(taskId)) return false;

    visited.add(taskId);
    recursionStack.add(taskId);

    const deps = dependsOn.get(taskId);
    if (deps) {
      for (const depId of deps) {
        if (hasCycle(depId)) return true;
      }
    }

    recursionStack.delete(taskId);
    return false;
  };

  for (const task of spec.tasks) {
    if (!visited.has(task.$id) && hasCycle(task.$id)) {
      issues.push({
        type: "task",
        message: "Circular dependency detected",
        entityId: task.$id,
        severity: "error",
        issueCode: "CIRCULAR_DEPENDENCY",
      });
      break;
    }
  }

  return issues;
}
