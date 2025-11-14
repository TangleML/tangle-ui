import type { ComponentSpec } from "@/utils/componentSpec";

/**
 * Generates arguments object from component spec inputs that have values or defaults.
 * Falls back to default if value is not provided.
 * @param componentSpec - The component specification containing inputs
 * @returns Object with input names as keys and their values/defaults as values
 */
export const getArgumentsFromInputs = (
  componentSpec: ComponentSpec,
): Record<string, string> => {
  const args: Record<string, string> = {};

  if (!componentSpec.inputs) {
    return args;
  }

  for (const input of componentSpec.inputs) {
    const inputValue = input.value ?? input.default;
    if (inputValue !== undefined && inputValue !== null) {
      args[input.name] = inputValue;
    }
  }

  return args;
};
