import { useSuspenseQuery } from "@tanstack/react-query";

import { useComponentLibrary } from "@/providers/ComponentLibraryProvider/ComponentLibraryProvider";
import { hydrateComponentReference } from "@/services/componentService";
import {
  type ComponentReference,
  type ComponentReferenceWithDigest,
  type HydratedComponentReference,
  isDiscoverableComponentReference,
} from "@/utils/componentSpec";

import { checkComponentUpdates } from "../../GitHubLibrary/utils/checkComponentUpdates";
import { hasSupersededBy } from "../types";
import { hydrateAllComponents } from "../utils/hydrateAllComponents";
import { useAllPublishedComponents } from "./useAllPublishedComponents";

function usedComponentsQueryKeyDigests(
  usedComponents: ComponentReference[],
): string[] {
  return usedComponents
    .map((c) => c.digest)
    .filter((d): d is string => Boolean(d))
    .sort();
}

export function useOutdatedComponents(usedComponents: ComponentReference[]) {
  const { data: publishedComponents } = useAllPublishedComponents();
  const { existingComponentLibraries, getComponentLibrary } =
    useComponentLibrary();

  const usedDigestsKey = usedComponentsQueryKeyDigests(usedComponents);

  return useSuspenseQuery({
    queryKey: ["outdated-components", usedDigestsKey],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const hydratedComponents = await hydrateAllComponents(usedComponents);
      const mostRecentComponents = await findMostRecentComponents(
        publishedComponents.components ?? [],
        hydratedComponents,
      );

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

      if (githubComponents.length > 0) {
        for (const { component, library } of githubComponents) {
          if (!library) {
            continue;
          }

          const updatedComponent = await checkComponentUpdates(
            component,
            library,
          );

          if (updatedComponent) {
            mostRecentComponents.set(component.digest, updatedComponent);
          }
        }
      }

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
  usedComponents: HydratedComponentReference[],
): Promise<Map<string, HydratedComponentReference>> {
  const usedDigests = new Set(usedComponents.map((c) => c.digest));
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
    const outdatedDigests: string[] = [];
    let current: ComponentReferenceWithDigest | undefined = supersededIndex.get(
      leaf.digest,
    );
    while (current) {
      if (usedDigests.has(current.digest)) {
        outdatedDigests.push(current.digest);
      }
      current = supersededIndex.get(current.digest);
    }

    if (outdatedDigests.length === 0) {
      continue;
    }

    const hydratedLeaf = await hydrateComponentReference(leaf);
    if (!hydratedLeaf) {
      continue;
    }

    for (const digest of outdatedDigests) {
      mostRecentComponents.set(digest, hydratedLeaf);
    }
  }

  return mostRecentComponents;
}
