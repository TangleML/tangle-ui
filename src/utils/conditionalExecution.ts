import type { ArgumentType, ComponentSpec, Task } from "@/models/componentSpec";
import { bindingToArgumentReference } from "@/models/componentSpec/bindingReference";

import {
  GRAPH_INPUT_REGEX,
  isGraphInputArgument,
  isTaskOutputArgument,
  TASK_OUTPUT_REGEX,
} from "./componentSpec";

/**
 * Reserved binding port name for a task's run condition. A connection to this
 * port serializes to `TaskSpec.isEnabled` instead of `TaskSpec.arguments[...]`.
 * The sentinel is intentionally unlikely to collide with a component input name.
 */
export const IS_ENABLED_PORT_NAME = "__is_enabled__";

export const RUN_CONDITION_LABEL = "Run when";

export const RUN_CONDITION_INPUT_NAME = "run_condition";

/**
 * The runtime contract for `isEnabled` is the strings `"true"` / `"false"`, and
 * port compatibility is an exact type-name match — a `Boolean` input would not
 * be offered for the `String` arguments components actually declare.
 */
export const RUN_CONDITION_INPUT_TYPE = "String";

export type ConditionLiteral = "true" | "false";

export const CONDITION_LITERAL_LABELS: Record<ConditionLiteral, string> = {
  true: "Always",
  false: "Never",
};

/**
 * The editor only ever writes the canonical strings, but a hand-authored or
 * SDK-generated pipeline can carry an unquoted YAML `false` (a JS boolean at
 * runtime, whatever the declared type says) or `"False"` — both of which the
 * backend honours, so both have to read as the negative literal here.
 */
export function toConditionLiteral(value: unknown): ConditionLiteral {
  return String(value).trim().toLowerCase() === "false" ? "false" : "true";
}

/**
 * True when an `isEnabled` value points at an upstream value (a graph input or a
 * sibling task output) rather than holding a literal such as `"false"`.
 */
export function isConditionalArgument(
  value: ArgumentType | undefined,
): value is ArgumentType {
  if (value === undefined) return false;
  if (typeof value === "string") {
    return GRAPH_INPUT_REGEX.test(value) || TASK_OUTPUT_REGEX.test(value);
  }
  return isGraphInputArgument(value) || isTaskOutputArgument(value);
}

function findConditionalBinding(
  spec: ComponentSpec | null | undefined,
  taskId: string,
) {
  return spec?.bindings.find(
    (b) =>
      b.targetEntityId === taskId && b.targetPortName === IS_ENABLED_PORT_NAME,
  );
}

/**
 * A task is conditional when it carries an `isEnabled` value — either a literal
 * on the entity or a connection to the reserved port. There is no separate flag:
 * the presence of the value is what exposes the port and the condition control.
 */
export function isTaskConditional(
  task: Task,
  spec: ComponentSpec | null | undefined,
): boolean {
  return (
    task.isEnabled !== undefined ||
    findConditionalBinding(spec, task.$id) !== undefined
  );
}

/** The upstream reference a task is gated on, in the shape it serializes to. */
export function resolveConditionalReference(
  task: Task,
  spec: ComponentSpec | null | undefined,
): ArgumentType | undefined {
  const binding = findConditionalBinding(spec, task.$id);
  if (!binding || !spec) return undefined;

  return bindingToArgumentReference(binding, spec);
}

/**
 * Handles the raw template form as well as the structured one, because a task
 * whose reference could not be resolved to a binding on load still holds the
 * template — and without it a dangling reference would fall back to the literal
 * label and read as "Always".
 */
export function describeConditionSource(
  reference: ArgumentType | undefined,
): string | undefined {
  if (isTaskOutputArgument(reference)) {
    const { taskId, outputName } = reference.taskOutput;
    return `→ ${taskId}.${outputName}`;
  }
  if (isGraphInputArgument(reference)) {
    return `→ ${reference.graphInput.inputName}`;
  }
  if (typeof reference === "string") {
    const graphInput = reference.match(GRAPH_INPUT_REGEX);
    if (graphInput) return `→ ${graphInput[1]}`;

    const taskOutput = reference.match(TASK_OUTPUT_REGEX);
    if (taskOutput) return `→ ${taskOutput[1]}.${taskOutput[2]}`;
  }
  return undefined;
}
