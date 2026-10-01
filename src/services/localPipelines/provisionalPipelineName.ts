import type { ComponentSpec } from "@/models/componentSpec";
import { PROVISIONAL_NAME_ANNOTATION } from "@/utils/annotationKeys";

/**
 * Whether the name is one nobody chose. A project opened from a prompt names
 * its first pipeline after the ask, and an agent has no other way to tell that
 * apart from a name the user typed.
 *
 * The mark lives on the spec, not the project resource, because the agent that
 * can act on it reads the canvas through `get_pipeline_state` and never sees
 * the row. Both forms are accepted: hand-edited YAML may hold anything at all
 * under the key.
 */
export function specNameIsProvisional(spec: ComponentSpec): boolean {
  const value = spec.annotations.get(PROVISIONAL_NAME_ANNOTATION);
  return value === true || value === "true";
}

export function clearProvisionalName(spec: ComponentSpec): void {
  if (!spec.annotations.has(PROVISIONAL_NAME_ANNOTATION)) return;
  spec.annotations.remove(PROVISIONAL_NAME_ANNOTATION);
}
