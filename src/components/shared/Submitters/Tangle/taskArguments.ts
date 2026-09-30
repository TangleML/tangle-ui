import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";

export function selectTaskArgumentsForInputs(
  componentSpec: ComponentSpec,
  savedTaskArguments?: Record<string, ArgumentType>,
  taskArguments?: Record<string, ArgumentType>,
): Record<string, ArgumentType> {
  const selected: Record<string, ArgumentType> = {};

  for (const input of componentSpec.inputs ?? []) {
    const value =
      taskArguments?.[input.name] ??
      input.value ??
      savedTaskArguments?.[input.name] ??
      input.default;
    if (value !== undefined) selected[input.name] = value;
  }

  return selected;
}
