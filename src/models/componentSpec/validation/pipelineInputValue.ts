/**
 * Shared rule for whether a pipeline-level input still needs a configured value
 * (default or runtime value). Aligns with legacy `validateInputsAndOutputs` and
 * `validateArguments` trim semantics.
 */
export function isPipelineInputMissingConfiguredValue(input: {
  optional?: boolean;
  default?: string;
  value?: string;
}): boolean {
  if (input.optional) return false;
  if (hasNonEmptyConfiguredString(input.default)) return false;
  if (hasNonEmptyConfiguredString(input.value)) return false;
  return true;
}

function hasNonEmptyConfiguredString(s: string | undefined): boolean {
  return String(s ?? "").trim().length > 0;
}
