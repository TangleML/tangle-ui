import type { ArgumentType } from "./componentSpec";
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
 * input or a sibling task output) — i.e. the "Conditional" mode — rather than a
 * plain literal such as `"false"`.
 */
export function isConditionalArgument(
  value: ArgumentType | undefined,
): boolean {
  if (value === undefined) return false;
  if (typeof value === "string") {
    return GRAPH_INPUT_REGEX.test(value) || TASK_OUTPUT_REGEX.test(value);
  }
  return isGraphInputArgument(value) || isTaskOutputArgument(value);
}
