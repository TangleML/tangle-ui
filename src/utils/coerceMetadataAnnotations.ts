import type { ComponentSpec } from "@/utils/componentSpec";

// The backend requires annotation values to be strings, including nested specs.
export const coerceMetadataAnnotations = (spec: ComponentSpec): void => {
  const annotations = spec.metadata?.annotations;
  if (annotations) {
    for (const key of Object.keys(annotations)) {
      const value = annotations[key];
      if (typeof value === "string") continue;
      if (value === null || value === undefined) {
        delete annotations[key];
        continue;
      }
      annotations[key] =
        typeof value === "object" ? JSON.stringify(value) : String(value);
    }
  }

  if (!spec.implementation || !("graph" in spec.implementation)) return;
  const tasks = spec.implementation.graph?.tasks;
  if (!tasks) return;
  for (const task of Object.values(tasks)) {
    const nestedSpec = task?.componentRef?.spec;
    if (nestedSpec) coerceMetadataAnnotations(nestedSpec);
  }
};
