import { useSuspenseQuery } from "@tanstack/react-query";

import { useComponentLibrary } from "@/providers/ComponentLibraryProvider/ComponentLibraryProvider";
import { hydrateComponentReference } from "@/services/componentService";
import {
  type ComponentReference,
  type ComponentReferenceWithDigest,
  type HydratedComponentReference,
  isDiscoverableComponentReference,
} from "@/utils/componentSpec";
import { HOURS } from "@/utils/constants";

import { checkComponentUpdates } from "../../GitHubLibrary/utils/checkComponentUpdates";
import { hasSupersededBy } from "../types";
import { hydrateAllComponents } from "../utils/hydrateAllComponents";
import { useAllPublishedComponents } from "./useAllPublishedComponents";

const OUTDATED_COMPONENTS_STALE_TIME = 1 * HOURS;

function usedComponentsQueryKeyDigests(
  usedComponents: ComponentReference[],
): string[] {
  return usedComponents
    .map((c) => c.digest)
    .filter((d): d is string => Boolean(d))
    .sort();
}

function useMostRecentComponents() {
  const { data: publishedComponents } = useAllPublishedComponents();

  return useSuspenseQuery({
    queryKey: ["outdated-components", "most-recent-map"],
    staleTime: OUTDATED_COMPONENTS_STALE_TIME,
    queryFn: () =>
      findMostRecentComponents(publishedComponents.components ?? []),
  });
}

/**
 * Hook to get the outdated components in the graph
 *
 * @param usedComponents - The components that are used in the graph
 * @returns
 */
export function useOutdatedComponents(usedComponents: ComponentReference[]) {
  const { existingComponentLibraries, getComponentLibrary } =
    useComponentLibrary();
  const { data: mostRecentComponents } = useMostRecentComponents();

  const usedDigestsKey = usedComponentsQueryKeyDigests(usedComponents);

  return useSuspenseQuery({
    queryKey: ["outdated-components", usedDigestsKey],
    staleTime: OUTDATED_COMPONENTS_STALE_TIME,
    queryFn: async () => {
      const hydratedComponents = await hydrateAllComponents(usedComponents);

      // check for github components
      // todo: generalize this to all libraries
      const githubLibs = existingComponentLibraries?.filter(
        (l) => l.type === "github",
      );
      const githubComponents =
        githubLibs && githubLibs.length > 0
          ? hydratedComponents
              .map((c) => ({
                component: c,
                library: githubLibs.find((l) =>
                  getComponentLibrary(l.id as any)?.hasComponent(c),
                ),
              }))
              .filter((c) => c.library)
          : [];

      const githubOverrides = new Map<string, HydratedComponentReference>();
      for (const { component, library } of githubComponents) {
        if (!library) {
          continue;
        }

        const updatedComponent = await checkComponentUpdates(
          component,
          library,
        );

        if (updatedComponent) {
          githubOverrides.set(component.digest, updatedComponent);
        }
      }

      return hydratedComponents
        .filter(
          (c) =>
            isDiscoverableComponentReference(c) &&
            (githubOverrides.has(c.digest) ||
              mostRecentComponents.has(c.digest)),
        )
        .map(
          (c) =>
            [
              c,
              (githubOverrides.get(c.digest) ??
                mostRecentComponents.get(
                  c.digest,
                )) as HydratedComponentReference,
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
