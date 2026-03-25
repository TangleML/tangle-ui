import type { Binding, ComponentSpec, InputSpec } from "@/models/componentSpec";

export function formatBindingSource(
  binding: Binding,
  spec: ComponentSpec,
): string {
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

export function getDisplayValue(
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
