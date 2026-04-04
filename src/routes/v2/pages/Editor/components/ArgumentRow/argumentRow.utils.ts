import type { Binding, ComponentSpec, InputSpec } from "@/models/componentSpec";
import type { DynamicDataArgument } from "@/utils/componentSpec";

function formatBindingSource(binding: Binding, spec: ComponentSpec): string {
  const sourceInput = spec.inputs.find((i) => i.$id === binding.sourceEntityId);
  if (sourceInput) {
    return `graphInput: ${sourceInput.name}`;
  }

  const sourceTask = spec.tasks.find((t) => t.$id === binding.sourceEntityId);
  if (sourceTask) {
    return `${sourceTask.name}.${binding.sourcePortName}`;
  }

  return `${binding.sourceEntityId}.${binding.sourcePortName}`;
}

function getDisplayValue(
  value: unknown,
  isSet: boolean,
  inputSpec: InputSpec,
): string {
  if (!isSet) {
    return inputSpec.default ? `default: ${inputSpec.default}` : "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value !== undefined && value !== null) {
    return JSON.stringify(value);
  }

  return "";
}

export function typeSpecToString(typeSpec?: unknown): string {
  if (typeSpec === undefined) return "";
  if (typeof typeSpec === "string") return typeSpec;
  return JSON.stringify(typeSpec);
}

export function isDynamicDataValue(
  value: unknown,
): value is DynamicDataArgument {
  return typeof value === "object" && value !== null && "dynamicData" in value;
}

export function canResetArgument(
  inputSpec: InputSpec,
  currentValue: unknown,
): boolean {
  return (
    inputSpec.default !== undefined &&
    (typeof currentValue !== "string" || currentValue !== inputSpec.default)
  );
}

/**
 * Determine the effective change for an argument edit and return an action
 * descriptor so the caller can dispatch it without branching.
 */
export function resolveArgumentChange(
  trimmed: string,
  currentValue: unknown,
  isSet: boolean,
  isBound: boolean,
): "noop" | "remove" | "set" {
  if (trimmed === "" && !isSet && !isBound) return "noop";
  const currentStr = typeof currentValue === "string" ? currentValue : "";
  if (trimmed === currentStr) return "noop";
  if (trimmed === "" && isSet) return "remove";
  return "set";
}

export function resolveDisplayValues(
  binding: Binding | undefined,
  spec: ComponentSpec,
  currentValue: unknown,
  isSet: boolean,
  inputSpec: InputSpec,
) {
  const isBound = binding !== undefined;
  const bindingLabel = isBound ? formatBindingSource(binding, spec) : undefined;
  const displayValue = isBound
    ? bindingLabel
    : getDisplayValue(currentValue, isSet, inputSpec);
  return { bindingLabel, displayValue: displayValue ?? "" };
}
