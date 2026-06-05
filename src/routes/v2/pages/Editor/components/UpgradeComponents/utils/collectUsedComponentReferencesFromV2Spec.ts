import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";

export const EMPTY_USED_COMPONENTS: ComponentReference[] = [];

/**
 * Unique component references used by tasks in the current V2 editor spec
 * (deduped by digest). Recurses through subgraphs so tasks nested inside
 * a group task are also considered for upgrades.
 * Mirrors {@link fetchUsedComponents} for graph tasks.
 */
export function collectUsedComponentReferencesFromV2Spec(
  spec: ComponentSpec,
): ComponentReference[] {
  const usedComponentsMap = new Map<string, ComponentReference>();

  function walk(s: ComponentSpec) {
    for (const task of s.tasks) {
      const key = task.componentRef.digest;
      if (key && !usedComponentsMap.has(key)) {
        usedComponentsMap.set(key, { ...task.componentRef });
      }
      if (task.subgraphSpec) walk(task.subgraphSpec);
    }
  }

  walk(spec);
  return Array.from(usedComponentsMap.values());
}
