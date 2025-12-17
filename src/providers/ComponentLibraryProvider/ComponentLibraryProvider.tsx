import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ComponentDuplicateDialog from "@/components/shared/Dialogs/ComponentDuplicateDialog";
import { GitHubFlatComponentLibrary } from "@/components/shared/GitHubLibrary/githubFlatComponentLibrary";
import {
  isGitHubLibraryConfiguration,
  isYamlLibraryConfiguration,
} from "@/components/shared/GitHubLibrary/types";
import {
  COMPONENT_LIBRARY_URL,
  hydrateComponentReference,
} from "@/services/componentService";
import type { ComponentFolder, SearchResult } from "@/types/componentLibrary";
import type {
  ComponentReference,
  HydratedComponentReference,
} from "@/utils/componentSpec";
import {
  deleteComponentFileFromList,
  importComponent,
} from "@/utils/componentStore";
import {
  ComponentSearchFilter,
  USER_COMPONENTS_LIST_NAME,
} from "@/utils/constants";
import { createPromiseFromDomEvent } from "@/utils/dom";
import { getComponentName } from "@/utils/getComponentName";
import {
  getUserComponentByName,
  type UserComponent,
} from "@/utils/localforage";
import {
  componentMatchesSearch,
  containsSearchTerm,
} from "@/utils/searchUtils";

import {
  createRequiredContext,
  useRequiredContext,
} from "../../hooks/useRequiredContext";
import { useComponentSpec } from "../ComponentSpecProvider";
import {
  fetchUsedComponents,
  fetchUserComponents,
  filterToUniqueByDigest,
  flattenFolders,
  populateComponentRefs,
} from "./componentLibrary";
import { useForcedSearchContext } from "./ForcedSearchProvider";
import {
  createLibraryObject,
  registerLibraryFactory,
} from "./libraries/factory";
import { FavoriteLibrary } from "./libraries/favoriteLibrary";
import { PublishedComponentsLibrary } from "./libraries/publishedComponentsLibrary";
import { LibraryDB, type StoredLibrary } from "./libraries/storage";
import type { Library } from "./libraries/types";
import { YamlFileLibrary } from "./libraries/yamlFileLibrary";

type AvailableComponentLibraries =
  | "published_components"
  | "favorite_components"
  | string;

type ComponentLibraryContextType = {
  userComponentsFolder: ComponentFolder | undefined;
  usedComponentsFolder: ComponentFolder;
  isLoading: boolean;
  error: Error | null;
  existingComponentLibraries: StoredLibrary[] | undefined;
  searchResult: SearchResult | null;

  searchComponentLibrary: (
    search: string,
    filters: string[],
  ) => Promise<SearchResult | null>;
  addToComponentLibrary: (
    component: HydratedComponentReference,
  ) => Promise<HydratedComponentReference | undefined>;
  removeFromComponentLibrary: (component: ComponentReference) => void;

  checkIfUserComponent: (component: ComponentReference) => boolean;

  getComponentLibrary: (libraryName: AvailableComponentLibraries) => Library;
};

const ComponentLibraryContext =
  createRequiredContext<ComponentLibraryContextType>(
    "ComponentLibraryProvider",
  );

/**
 * Register the GitHub library factory. This allows to have multiple instances of the same library type.
 */
registerLibraryFactory("github", (library) => {
  if (!isGitHubLibraryConfiguration(library.configuration)) {
    throw new Error(
      `GitHub library configuration is not valid for "${library.id}"`,
    );
  }

  return new GitHubFlatComponentLibrary(library.configuration.repo_name);
});

/**
 * Register the GitHub library factory. This allows to have multiple instances of the same library type.
 */
registerLibraryFactory("yaml", (library) => {
  if (!isYamlLibraryConfiguration(library.configuration)) {
    throw new Error(
      `YAML library configuration is not valid for "${library.id}"`,
    );
  }

  return new YamlFileLibrary(library.name, library.configuration.yaml_url);
});

function useComponentLibraryRegistry() {
  const queryClient = useQueryClient();
  const [existingComponentLibraries, setExistingComponentLibraries] = useState<
    StoredLibrary[]
  >([]);

  const componentLibraries = useMemo(
    () =>
      new Map<AvailableComponentLibraries, Library>([
        ["published_components", new PublishedComponentsLibrary(queryClient)],
        ["favorite_components", new FavoriteLibrary()],
        /**
         * In future we will have other library types,  including "standard_library", "favorite_components", "used_components", etc.
         */
        [
          "standard_components",
          new YamlFileLibrary("Standard library", COMPONENT_LIBRARY_URL),
        ],
      ]),
    [queryClient],
  );

  /**
   * Sync the existing component libraries with the component libraries map
   */
  const registeredComponentLibraries = useLiveQuery(() =>
    LibraryDB.component_libraries.toArray(),
  );

  useEffect(() => {
    const customLibraries =
      registeredComponentLibraries?.filter(
        (library) => library.type !== "indexdb",
      ) ?? [];

    customLibraries
      .filter((library) => !componentLibraries.has(library.id))
      .forEach((library) => {
        componentLibraries.set(library.id, createLibraryObject(library));
      });

    setExistingComponentLibraries(customLibraries);
  }, [registeredComponentLibraries, componentLibraries]);

  const getComponentLibraryObject = useCallback(
    (libraryName: AvailableComponentLibraries) => {
      if (!componentLibraries.has(libraryName)) {
        throw new Error(`Component library "${libraryName}" is not found.`);
      }

      return componentLibraries.get(libraryName) as Library;
    },
    [componentLibraries],
  );

  return { getComponentLibraryObject, existingComponentLibraries };
}

export const ComponentLibraryProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { graphSpec } = useComponentSpec();
  const { currentSearchFilter } = useForcedSearchContext();

  const { getComponentLibraryObject, existingComponentLibraries } =
    useComponentLibraryRegistry();

  const [userComponentsFolder, setUserComponentsFolder] =
    useState<ComponentFolder>();

  const [existingComponent, setExistingComponent] =
    useState<UserComponent | null>(null);
  const [newComponent, setNewComponent] =
    useState<HydratedComponentReference | null>(null);

  // Fetch user components
  const {
    data: rawUserComponentsFolder,
    isLoading: isUserComponentsLoading,
    error: userComponentsError,
    refetch: refetchUserComponents,
  } = useQuery({
    queryKey: ["userComponents"],
    queryFn: fetchUserComponents,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch "Used in Pipeline" components
  const usedComponentsFolder: ComponentFolder = useMemo(
    () => fetchUsedComponents(graphSpec),
    [graphSpec],
  );

  // Methods
  const refreshUserComponents = useCallback(async () => {
    const { data: updatedUserComponents } = await refetchUserComponents();

    if (updatedUserComponents) {
      populateComponentRefs(updatedUserComponents).then((result) => {
        setUserComponentsFolder(result);
      });
    }
  }, [refetchUserComponents]);

  const checkIfUserComponent = useCallback(
    (component: ComponentReference) => {
      if (!userComponentsFolder) return false;

      const uniqueUserComponents = filterToUniqueByDigest(
        flattenFolders(userComponentsFolder),
      );

      return uniqueUserComponents.some((c) => c.digest === component.digest);
    },
    [userComponentsFolder],
  );

  /**
   * Local component library search
   */
  const searchComponentLibrary = useCallback(
    async (search: string, filters: string[]) => {
      if (!search.trim()) return null;

      const filtersSet = new Set(filters);

      const exactMatch = filtersSet.has(ComponentSearchFilter.EXACTMATCH);
      const hasNameFilter = filtersSet.has(ComponentSearchFilter.NAME);

      // Helper to check if a component matches the search criteria
      const componentMatches = (c: ComponentReference): boolean => {
        // If spec is available, use the full search
        if (c.spec && componentMatchesSearch(c.spec, search, filters)) {
          return true;
        }

        // Fallback: if searching by NAME and component has a name but no spec,
        // match against the component reference's name directly
        if (hasNameFilter && c.name && !c.spec) {
          return containsSearchTerm(c.name, search, exactMatch);
        }

        return false;
      };

      const result: SearchResult = {
        components: {
          standard: [],
          user: [],
          used: [],
        },
      };

      // classic search is not supported for now

      if (userComponentsFolder) {
        const uniqueComponents = filterToUniqueByDigest(
          flattenFolders(userComponentsFolder),
        );
        result.components.user = uniqueComponents.filter(componentMatches);
      }

      if (usedComponentsFolder) {
        const uniqueComponents = filterToUniqueByDigest(
          flattenFolders(usedComponentsFolder),
        );
        result.components.used = uniqueComponents.filter(componentMatches);
      }

      return result;
    },
    [userComponentsFolder, usedComponentsFolder],
  );

  const internalAddComponentToLibrary = useCallback(
    async (hydratedComponent: HydratedComponentReference) => {
      await importComponent(hydratedComponent);

      await refreshUserComponents();
      setNewComponent(null);
      setExistingComponent(null);

      dispatchEvent(
        new CustomEvent("tangle.library.componentAdded", {
          detail: {
            component: hydratedComponent,
          },
        }),
      );
    },
    [refreshUserComponents, importComponent],
  );

  const handleImportComponent = useCallback(
    async (yamlString: string) => {
      try {
        const hydratedComponent = await hydrateComponentReference({
          text: yamlString,
        });

        if (!hydratedComponent) {
          throw new Error("Failed to hydrate component");
        }

        await internalAddComponentToLibrary(hydratedComponent);
      } catch (error) {
        console.error("Error importing component:", error);
      }
    },
    [newComponent, refreshUserComponents, importComponent],
  );

  const addToComponentLibraryWithDuplicateCheck = useCallback(
    async (component: HydratedComponentReference) => {
      const duplicate = userComponentsFolder
        ? flattenFolders(userComponentsFolder).find(
            (c) => getComponentName(c) === getComponentName(component),
          )
        : undefined;

      const existingUserComponent = duplicate?.name
        ? await getUserComponentByName(duplicate.name)
        : undefined;

      if (
        existingUserComponent &&
        existingUserComponent.componentRef.digest !== component.digest
      ) {
        setExistingComponent(existingUserComponent);
        setNewComponent(component);
        return;
      }

      try {
        await internalAddComponentToLibrary(component);
      } catch (error) {
        console.error("Error adding component to library:", error);
      }
    },
    [userComponentsFolder, refreshUserComponents, importComponent],
  );

  const addToComponentLibrary = useCallback(
    async (
      hydratedComponentRef: HydratedComponentReference,
    ): Promise<HydratedComponentReference | undefined> => {
      const abortController = new AbortController();
      const [result, _] = await Promise.all([
        Promise.race([
          createPromiseFromDomEvent(
            window,
            "tangle.library.componentAdded",
            abortController.signal,
          ),
          createPromiseFromDomEvent(
            window,
            "tangle.library.duplicateDialogClosed",
            abortController.signal,
          ),
        ]),
        addToComponentLibraryWithDuplicateCheck(hydratedComponentRef),
      ]).finally(() => {
        abortController.abort();
      });

      return result instanceof CustomEvent ? hydratedComponentRef : undefined;
    },
    [addToComponentLibraryWithDuplicateCheck],
  );

  const removeFromComponentLibrary = useCallback(
    async (component: ComponentReference) => {
      try {
        if (component.name) {
          await deleteComponentFileFromList(
            USER_COMPONENTS_LIST_NAME,
            component.name,
          ).then(async () => {
            await refreshUserComponents();
          });
        } else {
          console.error(
            `Error deleting component: Component ${component.digest} does not have a name.`,
          );
        }
      } catch (error) {
        console.error("Error deleting component:", error);
      }
    },
    [refreshUserComponents],
  );

  const handleCloseDuplicationDialog = useCallback(() => {
    setExistingComponent(null);
    setNewComponent(null);

    dispatchEvent(new CustomEvent("tangle.library.duplicateDialogClosed"));
  }, []);

  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    searchComponentLibrary(
      currentSearchFilter.searchTerm,
      currentSearchFilter.filters,
    ).then((result) => {
      if (!cancelled) {
        setSearchResult(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentSearchFilter, searchComponentLibrary]);

  useEffect(() => {
    if (!rawUserComponentsFolder) {
      setUserComponentsFolder(undefined);
      return;
    }
    populateComponentRefs(rawUserComponentsFolder).then((result) => {
      setUserComponentsFolder(result);
    });
  }, [rawUserComponentsFolder]);

  const getComponentLibrary = useCallback(
    (libraryName: AvailableComponentLibraries) => {
      return getComponentLibraryObject(libraryName);
    },
    [],
  );

  const isLoading = isUserComponentsLoading;
  const error = userComponentsError;

  const value = useMemo(
    () => ({
      userComponentsFolder,
      usedComponentsFolder,
      isLoading,
      error,
      searchResult,
      existingComponentLibraries,
      searchComponentLibrary,
      getComponentLibrary,
      addToComponentLibrary,
      removeFromComponentLibrary,
      checkIfUserComponent,
    }),
    [
      userComponentsFolder,
      usedComponentsFolder,
      isLoading,
      error,
      searchResult,
      existingComponentLibraries,
      searchComponentLibrary,
      getComponentLibrary,
      addToComponentLibrary,
      removeFromComponentLibrary,
      checkIfUserComponent,
    ],
  );

  return (
    <ComponentLibraryContext.Provider value={value}>
      {children}
      <ComponentDuplicateDialog
        existingComponent={existingComponent ?? undefined}
        newComponent={newComponent}
        setClose={handleCloseDuplicationDialog}
        handleImportComponent={handleImportComponent}
      />
    </ComponentLibraryContext.Provider>
  );
};

export const useComponentLibrary = () => {
  return useRequiredContext(ComponentLibraryContext);
};
