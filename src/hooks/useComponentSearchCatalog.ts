import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";

import { useBackend } from "@/providers/BackendProvider";
import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";
import {
  hydratedComponentCatalogQuery,
  publishedComponentsQuery,
  registeredComponentsQuery,
  standardComponentLibraryQuery,
  userComponentsQuery,
} from "@/services/componentSearchCatalog";
import { collectAllSourcedReferences } from "@/services/componentSearchLogic";

export function useComponentSearchCatalog(hydrate: boolean) {
  const { backendUrl, configured, available } = useBackend();
  const queryClient = useQueryClient();
  const standard = useQuery(standardComponentLibraryQuery);
  const user = useQuery(userComponentsQuery);
  const published = useQuery({
    ...publishedComponentsQuery(backendUrl),
    enabled: configured && available,
  });
  const libraries = useLiveQuery(
    () => LibraryDB.component_libraries.toArray(),
    [],
  );
  const registered = useQuery({
    ...registeredComponentsQuery(libraries),
    enabled: libraries !== undefined,
  });
  const references = collectAllSourcedReferences({
    standardLibrary: standard.data,
    userFolder: user.data,
    publishedRefs: published.data ?? [],
    registeredSourced: registered.data ?? [],
  });
  const hydrated = useQuery({
    ...hydratedComponentCatalogQuery(queryClient, references),
    enabled: hydrate && references.length > 0,
  });
  return {
    standardLibrary: standard.data,
    references,
    index: hydrated.data?.index ?? [],
    sourcedHydrated: hydrated.data?.sourcedHydrated ?? [],
    isLoading:
      standard.isLoading ||
      user.isLoading ||
      published.isLoading ||
      libraries === undefined ||
      registered.isLoading,
    isHydrating: hydrated.isLoading,
  };
}
