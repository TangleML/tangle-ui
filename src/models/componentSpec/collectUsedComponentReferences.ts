import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";

export const EMPTY_USED_COMPONENTS: ComponentReference[] = [];

/**
 * Unique component references used by tasks in the current editor spec
 * (deduped by digest).
 */
export function collectUsedComponentReferences(
  spec: ComponentSpec,
): ComponentReference[] {
  const usedComponentsMap = new Map<string, ComponentReference>();

  for (const task of spec.tasks) {
    const key = task.componentRef.digest;
    if (key && !usedComponentsMap.has(key)) {
      usedComponentsMap.set(key, { ...task.componentRef });
    }
  }

  return Array.from(usedComponentsMap.values());
}
