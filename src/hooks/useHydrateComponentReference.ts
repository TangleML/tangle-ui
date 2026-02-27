import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";

import { hydrateComponentReference } from "@/services/componentService";
import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";
import {
  isGraphImplementation,
  isNotMaterializedComponentReference,
} from "@/utils/componentSpec";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";
import { componentSpecToText } from "@/utils/yaml";

/**
 * Generate a unique query key for a component reference.
 * For components with digest or URL, use those directly.
 * For inline specs, use a JSON stringification as a stable key.
 */
function getComponentQueryKey(component: ComponentReference): string {
  if (component.digest) {
    return `digest:${component.digest}`;
  }

  if (component.url) {
    return `url:${component.url}`;
  }

  if (component.text) {
    return `text:${component.text}`;
  }

  if (component.spec) {
    const specYaml = componentSpecToText(component.spec);
    return `spec:${specYaml}`;
  }

  return `empty:${JSON.stringify(component)}`;
}

const generateHydrationQueryKey = (component: ComponentReference) => {
  return ["component", "hydrate", getComponentQueryKey(component)];
};

/**
 * Hydrate a component reference by fetching the text and spec from the URL or local storage
 * This is experimental function, that potentially can replace all other methods of getting ComponentRef.
 *
 * @param component - The component reference to hydrate
 * @returns The hydrated component reference or null if the component reference is invalid
 */
export function useHydrateComponentReference(component: ComponentReference) {
  /**
   * If the component has a digest or url, we can assume that the component is not going to change frequently
   * Otherwise we dont cache result.
   */

  const componentQueryKey = generateHydrationQueryKey(component);

  const staleTime = componentQueryKey[2] ? 1000 * 60 * 60 * 1 : 0;

  const { data: componentRef } = useSuspenseQuery({
    queryKey: componentQueryKey,
    staleTime,
    retryOnMount: true,
    queryFn: () => hydrateComponentReference(component),
  });

  return componentRef;
}

class ComponentHydrationError extends Error {
  name = "ComponentHydrationError";

  constructor(public readonly component: ComponentReference) {
    super(
      `Failed to hydrate component reference: ${component.digest ?? component.url ?? "unknown"}`,
    );
  }
}

export function useGuaranteedHydrateComponentReference(
  component: ComponentReference,
) {
  const hydratedComponentRef = useHydrateComponentReference(component);
  if (!hydratedComponentRef) {
    throw new ComponentHydrationError(component);
  }

  return hydratedComponentRef;
}

export function usePreHydrateComponentRefs(componentSpec: ComponentSpec) {
  const tasks = isGraphImplementation(componentSpec.implementation)
    ? componentSpec.implementation.graph?.tasks
    : {};
  const componentRefs = Object.values(tasks)
    .map((task) => task.componentRef)
    .filter((ref) => ref && !isNotMaterializedComponentReference(ref));

  const results = useSuspenseQueries({
    queries: componentRefs.map((ref) => ({
      queryKey: generateHydrationQueryKey(ref),
      queryFn: () => hydrateComponentReference(ref),
      staleTime: TWENTY_FOUR_HOURS_IN_MS,
    })),
  });

  return results.map((result) => result.data);
}
