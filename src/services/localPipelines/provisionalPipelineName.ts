import type { ComponentSpec } from "@/models/componentSpec";
import { PROVISIONAL_NAME_ANNOTATION } from "@/utils/annotationKeys";

/**
 * Marks a pipeline name as one nobody chose. A project opened from a prompt
 * names its first pipeline after the ask, which reads as a restatement of the
 * request rather than a title for the work, and an agent has no other way to
 * tell that apart from a name the user typed.
 *
 * The mark lives on the spec rather than on the project resource because the
 * agent that can act on it edits the spec: it reads the canvas through
 * `get_pipeline_state` and never sees the row. `set_pipeline_name` clears it,
 * so a name chosen by whoever renamed next is left alone.
 */
/** Hand-edited YAML may hold anything at all under the key. */
export function specNameIsProvisional(spec: ComponentSpec): boolean {
  const value = spec.annotations.get(PROVISIONAL_NAME_ANNOTATION);
  return value === true || value === "true";
}

export function clearProvisionalName(spec: ComponentSpec): void {
  if (!spec.annotations.has(PROVISIONAL_NAME_ANNOTATION)) return;
  spec.annotations.remove(PROVISIONAL_NAME_ANNOTATION);
}
