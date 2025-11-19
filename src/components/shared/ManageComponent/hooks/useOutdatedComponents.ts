import { useSuspenseQuery } from "@tanstack/react-query";

import { hydrateComponentReference } from "@/services/componentService";
import {
  type ComponentReference,
  type ComponentReferenceWithDigest,
  type HydratedComponentReference,
  isDiscoverableComponentReference,
} from "@/utils/componentSpec";

import { hasSupersededBy } from "../types";
import { hydrateAllComponents } from "../utils/hydrateAllComponents";
import { useAllPublishedComponents } from "./useAllPublishedComponents";

/**
 * Hook to get the outdated components in the graph
 *
 * @param usedComponents - The components that are used in the graph
 * @returns
 */
export function useOutdatedComponents(usedComponents: ComponentReference[]) {
  const { data: publishedComponents } = useAllPublishedComponents();

  return useSuspenseQuery({
    queryKey: ["outdated-components", usedComponents],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const mostRecentComponents = await findMostRecentComponents(
        publishedComponents.components ?? [],
      );

      const hydratedComponents = await hydrateAllComponents(usedComponents);

      return hydratedComponents
        .filter(
          (c) =>
            isDiscoverableComponentReference(c) &&
            mostRecentComponents.has(c.digest),
        )
        .map(
          (c) =>
            [
              c,
              mostRecentComponents.get(c.digest) as HydratedComponentReference,
            ] as const,
        );
    },
  });
}

async function findMostRecentComponents(
  components: ComponentReference[],
): Promise<Map<string, HydratedComponentReference>> {
  const componentsWithDigest = components.filter((c) =>
    isDiscoverableComponentReference(c),
  );

  const supersededIndex = new Map<string, ComponentReferenceWithDigest>(
    componentsWithDigest
      .filter((c) => hasSupersededBy(c))
      .map((c) => [c.superseded_by, c]),
  );

  const mostRecentComponents = new Map<string, HydratedComponentReference>();

  const leafList = componentsWithDigest.filter((c) => !c.superseded_by);

  for (const leaf of leafList) {
    let current: ComponentReferenceWithDigest | undefined = supersededIndex.get(
      leaf.digest,
    );
    const hydratedLeaf = await hydrateComponentReference(leaf);
    while (current && hydratedLeaf) {
      mostRecentComponents.set(current.digest, hydratedLeaf);
      current = supersededIndex.get(current.digest);
    }
  }

  return mostRecentComponents;
}
