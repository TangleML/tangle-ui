import Bugsnag from "@bugsnag/js";
import { QueryClient, queryOptions } from "@tanstack/react-query";

import { listApiPublishedComponentsGet } from "@/api/sdk.gen";
import { getComponentQueryKey } from "@/hooks/useHydrateComponentReference";
import {
  fetchUserComponents,
  flattenFolders,
} from "@/providers/ComponentLibraryProvider/componentLibrary";
import { createLibraryObject } from "@/providers/ComponentLibraryProvider/libraries/factory";
import { ensureLibraryFactoriesRegistered } from "@/providers/ComponentLibraryProvider/libraries/setup";
import {
  LibraryDB,
  type StoredLibrary,
} from "@/providers/ComponentLibraryProvider/libraries/storage";
import {
  buildSearchIndex,
  type SourcedReference,
} from "@/services/componentSearchIndex";
import {
  collectAllSourcedReferences,
  registeredLibrariesFingerprint,
  registeredSource,
} from "@/services/componentSearchLogic";
import {
  fetchAndStoreComponentLibrary,
  hydrateComponentReference,
} from "@/services/componentService";
import { IS_BUGSNAG_ENABLED } from "@/services/errorManagement/bugsnag";
import type { ComponentReference } from "@/utils/componentSpec";
import { HOURS } from "@/utils/constants";

export const standardComponentLibraryQuery = queryOptions({
  queryKey: ["componentLibrary"],
  queryFn: fetchAndStoreComponentLibrary,
  staleTime: HOURS,
});

export const userComponentsQuery = queryOptions({
  queryKey: ["userComponents"],
  queryFn: fetchUserComponents,
  staleTime: 0,
  refetchOnMount: "always",
});

export function publishedComponentsQuery(backendUrl: string) {
  return queryOptions({
    queryKey: ["component-search", "published", backendUrl],
    staleTime: HOURS,
    queryFn: async (): Promise<ComponentReference[]> => {
      const result = await listApiPublishedComponentsGet({
        baseUrl: backendUrl,
      });
      if (result.response.status !== 200 || !result.data) return [];
      return (result.data.published_components ?? [])
        .filter((component) => !component.deprecated)
        .map((component) => ({
          digest: component.digest,
          name: component.name ?? undefined,
          url:
            component.url ?? `${backendUrl}/api/components/${component.digest}`,
          published_by: component.published_by,
        }));
    },
  });
}

export function registeredComponentsQuery(
  libraries: StoredLibrary[] | undefined,
) {
  return queryOptions({
    queryKey: [
      "component-search",
      "registered-libraries",
      registeredLibrariesFingerprint(libraries),
    ],
    staleTime: HOURS,
    queryFn: async (): Promise<SourcedReference[]> => {
      ensureLibraryFactoriesRegistered();
      const results = await Promise.allSettled(
        (libraries ?? []).map(async (library) => ({
          library,
          folder: await createLibraryObject(library).getComponents({}),
        })),
      );
      const sourced: SourcedReference[] = [];
      for (const result of results) {
        if (result.status === "rejected") {
          const error =
            result.reason instanceof Error
              ? result.reason
              : new Error(String(result.reason));
          if (IS_BUGSNAG_ENABLED) Bugsnag.notify(error);
          console.warn("Components: registered library failed to load", error);
          continue;
        }
        const source = registeredSource(result.value.library);
        for (const reference of flattenFolders(result.value.folder))
          sourced.push({ reference, source });
      }
      return sourced;
    },
  });
}

export function hydratedComponentCatalogQuery(
  queryClient: QueryClient,
  references: SourcedReference[],
) {
  const fingerprint = references
    .map(
      ({ source, reference }) =>
        `${source.kind}:${source.id}:${source.label}:${reference.digest ?? reference.url ?? ""}`,
    )
    .sort()
    .join("|");
  return queryOptions({
    queryKey: ["component-search", "catalog", fingerprint],
    staleTime: HOURS,
    queryFn: async () => {
      const results = await Promise.all(
        references.map(async ({ reference, source }) => {
          const hydrated = await queryClient
            .ensureQueryData({
              queryKey: [
                "component",
                "hydrate",
                getComponentQueryKey(reference),
              ],
              staleTime: HOURS,
              queryFn: () => hydrateComponentReference(reference),
            })
            .catch(() => null);
          return hydrated ? { reference: hydrated, source } : null;
        }),
      );
      const sourcedHydrated = results.filter(
        (item): item is NonNullable<typeof item> => item !== null,
      );
      return { sourcedHydrated, index: buildSearchIndex(sourcedHydrated) };
    },
  });
}

/** The agent uses the same catalogue without mounting React providers. */
export async function loadComponentSearchCatalog(
  backendUrl: string,
  queryClient?: QueryClient,
) {
  const cache = queryClient ?? new QueryClient();
  try {
    ensureLibraryFactoriesRegistered();
    const libraries = await LibraryDB.component_libraries.toArray();
    const [standardLibrary, userFolder, publishedRefs, registeredSourced] =
      await Promise.all([
        cache.ensureQueryData(standardComponentLibraryQuery),
        cache.ensureQueryData(userComponentsQuery),
        backendUrl
          ? cache
              .ensureQueryData(publishedComponentsQuery(backendUrl))
              .catch(() => [])
          : [],
        cache.ensureQueryData(registeredComponentsQuery(libraries)),
      ]);
    return await cache.ensureQueryData(
      hydratedComponentCatalogQuery(
        cache,
        collectAllSourcedReferences({
          standardLibrary,
          userFolder,
          publishedRefs,
          registeredSourced,
        }),
      ),
    );
  } finally {
    if (!queryClient) cache.clear();
  }
}
