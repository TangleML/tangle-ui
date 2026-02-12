import { useSuspenseQuery } from "@tanstack/react-query";

import { hydrateComponentReference } from "@/services/componentService";
import type { ComponentReference } from "@/utils/componentSpec";
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
    // For inline specs, create a unique key based on the actual spec content
    // Use JSON.stringify to ensure any change to the spec creates a new key
    try {
      const specString = JSON.stringify(component.spec);
      return `spec:${specString}`;
    } catch (e) {
      // Fallback if stringification fails
      const inputNames = component.spec.inputs?.map(i => i.name).sort().join(',') ?? '';
      const inputCount = component.spec.inputs?.length ?? 0;
      const specName = component.spec.name ?? 'unnamed';
      return `spec:${specName}:${inputCount}:${inputNames}:${Date.now()}`;
    }
  }

  return `empty:${JSON.stringify(component)}`;
}

/**
 * Hydrate a component reference by fetching the text and spec from the URL or local storage
 * This is experimental function, that potentially can replace all other methods of getting ComponentRef.
 *
 * @param component - The component reference to hydrate
 * @returns The hydrated component reference or null if the component reference is invalid
 */
export function useHydrateComponentReference(component: ComponentReference) {
  /**
   * If there's an inline spec, ALWAYS use it directly, even if there's also a url/digest.
   * This is critical for aggregator nodes where we dynamically modify the spec while
   * preserving the original url/digest for reference.
   */
  if (component.spec) {
    // Return inline spec directly without React Query caching
    return component as any;
  }

  /**
   * For components with digest or url, we can cache them since they don't change frequently
   */
  const componentQueryKey = getComponentQueryKey(component);
  const staleTime = 1000 * 60 * 60 * 1; // 1 hour cache for URL/digest components

  const { data: componentRef } = useSuspenseQuery({
    queryKey: ["component", "hydrate", componentQueryKey],
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
