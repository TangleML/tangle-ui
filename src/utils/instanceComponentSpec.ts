import type { ComponentSpec } from "./componentSpec";

/**
 * Creates a unique instance of a component spec for a specific task.
 * This allows each task to have its own mutable spec without affecting
 * the library template or other instances.
 */
export const instanceComponentSpec = (
  templateSpec: ComponentSpec,
): ComponentSpec => {
  // Deep clone the spec to create a completely independent instance
  return JSON.parse(JSON.stringify(templateSpec));
};

/**
 * Checks if a component spec should be instanced per-task.
 * Currently, only aggregator components need per-task instances.
 */
export const shouldInstanceSpec = (spec: ComponentSpec): boolean => {
  const annotations = spec.metadata?.annotations;
  if (!annotations) return false;
  
  // Check for pipeline aggregator annotation
  return annotations["pipeline.aggregator"] === "true";
};
