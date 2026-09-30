import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";

export function selectTaskArgumentsForInputs(
  componentSpec: ComponentSpec,
  ...sources: Array<Record<string, ArgumentType> | undefined>
): Record<string, ArgumentType> {
  const inputNames = new Set(
    (componentSpec.inputs ?? []).map((input) => input.name),
  );
  const selected: Record<string, ArgumentType> = {};

  for (const source of sources) {
    for (const [name, value] of Object.entries(source ?? {})) {
      if (inputNames.has(name)) selected[name] = value;
    }
  }

  return selected;
}
