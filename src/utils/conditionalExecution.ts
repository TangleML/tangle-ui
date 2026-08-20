import type { ArgumentType, ComponentSpec, Task } from "@/models/componentSpec";

import { isGraphInputArgument, isTaskOutputArgument } from "./componentSpec";

/**
 * Reserved binding port name used to model the virtual "Is enabled?" input on a
 * task node. A connection to this port is serialized to `TaskSpec.isEnabled`
 * instead of `TaskSpec.arguments[...]`. The sentinel is intentionally unlikely
 * to collide with a real component input name.
 */
export const IS_ENABLED_PORT_NAME = "__is_enabled__";

/** Human-readable label shown for the virtual "Is enabled?" input. */
export const IS_ENABLED_INPUT_LABEL = "Is enabled?";

const GRAPH_INPUT_REGEX = /^\{\{inputs\.([^}]+)\}\}$/;
const TASK_OUTPUT_REGEX = /^\{\{tasks\.([^.]+)\.outputs\.([^}]+)\}\}$/;

/**
 * True when an `isEnabled` value is a reference to an upstream value (a graph
 * input or a sibling task output) rather than a plain literal such as `"false"`.
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

/**
 * The upstream reference a task is gated on, in the shape it serializes to, or
 * undefined when the task is gated on a literal.
 */
export function resolveConditionalReference(
  task: Task,
  spec: ComponentSpec | null | undefined,
): ArgumentType | undefined {
  const binding = findConditionalBinding(spec, task.$id);
  if (!binding || !spec) return undefined;

  const sourceTask = spec.tasks.find((t) => t.$id === binding.sourceEntityId);
  if (sourceTask) {
    return {
      taskOutput: {
        taskId: sourceTask.name,
        outputName: binding.sourcePortName,
      },
    };
  }

  const sourceInput = spec.inputs.find((i) => i.$id === binding.sourceEntityId);
  if (sourceInput) {
    return { graphInput: { inputName: sourceInput.name } };
  }

  return undefined;
}
