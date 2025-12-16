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
import { isGitHubLibraryConfiguration } from "@/components/shared/GitHubLibrary/types";
import {
  fetchAndStoreComponentLibrary,
  hydrateComponentReference,
} from "@/services/componentService";
import type {
  ComponentFolder,
  ComponentLibrary,
  SearchResult,
} from "@/types/componentLibrary";
import type {
  ComponentReference,
  HydratedComponentReference,
} from "@/utils/componentSpec";
import {
  type ComponentReferenceWithSpec,
  deleteComponentFileFromList,
  importComponent,
  updateComponentInListByText,
  updateComponentRefInList,
} from "@/utils/componentStore";
import { MINUTES, USER_COMPONENTS_LIST_NAME } from "@/utils/constants";
import { createPromiseFromDomEvent } from "@/utils/dom";
import { getComponentName } from "@/utils/getComponentName";
import {
  getComponentByUrl,
  getUserComponentByName,
  saveComponent,
  type UserComponent,
} from "@/utils/localforage";
import { componentMatchesSearch } from "@/utils/searchUtils";

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
  isFavoriteComponent,
  populateComponentRefs,
} from "./componentLibrary";
import { useForcedSearchContext } from "./ForcedSearchProvider";
import {
  createLibraryObject,
  registerLibraryFactory,
} from "./libraries/factory";
import { PublishedComponentsLibrary } from "./libraries/publishedComponentsLibrary";
import { LibraryDB, type StoredLibrary } from "./libraries/storage";
import type { Library } from "./libraries/types";

type AvailableComponentLibraries = "published_components" | string;

type ComponentLibraryContextType = {
  componentLibrary: ComponentLibrary | undefined;
  userComponentsFolder: ComponentFolder | undefined;
  usedComponentsFolder: ComponentFolder;
  favoritesFolder: ComponentFolder | undefined;
  isLoading: boolean;
  error: Error | null;
  existingComponentLibraries: StoredLibrary[] | undefined;
  searchResult: SearchResult | null;

  searchComponentLibrary: (
    search: string,
    filters: string[],
  ) => SearchResult | null;
  addToComponentLibrary: (
    component: HydratedComponentReference,
  ) => Promise<HydratedComponentReference | undefined>;
  removeFromComponentLibrary: (component: ComponentReference) => void;
  setComponentFavorite: (
    component: ComponentReference,
    favorited: boolean,
  ) => void;
  checkIfUserComponent: (component: ComponentReference) => boolean;
  checkLibraryContainsComponent: (component: ComponentReference) => boolean;

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

function useComponentLibraryRegistry() {
  const queryClient = useQueryClient();
  const [existingComponentLibraries, setExistingComponentLibraries] = useState<
    StoredLibrary[]
  >([]);

  const componentLibraries = useMemo(
    () =>
      new Map<AvailableComponentLibraries, Library>([
        ["published_components", new PublishedComponentsLibrary(queryClient)],
        /**
         * In future we will have other library types,  including "standard_library", "favorite_components", "used_components", etc.
         */
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
    registeredComponentLibraries?.forEach((library) => {
      componentLibraries.set(library.id, createLibraryObject(library));
    });

    setExistingComponentLibraries(registeredComponentLibraries ?? []);
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

  const [componentLibrary, setComponentLibrary] = useState<ComponentLibrary>();
  const [userComponentsFolder, setUserComponentsFolder] =
    useState<ComponentFolder>();

  const [existingComponent, setExistingComponent] =
    useState<UserComponent | null>(null);
  const [newComponent, setNewComponent] =
    useState<HydratedComponentReference | null>(null);

  // Fetch main component library
  const {
    data: rawComponentLibrary,
    isLoading: isLibraryLoading,
    error: libraryError,
    refetch: refetchLibrary,
  } = useQuery({
    queryKey: ["componentLibrary"],
    queryFn: fetchAndStoreComponentLibrary,
  });

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

  // Fetch "Starred" components
  const { data: favoritesFolderData, refetch: refetchFavorites } = useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const favoritesFolder: ComponentFolder = {
        name: "Favorite Components",
        components: [],
        folders: [],
        isUserFolder: false,
      };

      if (!componentLibrary || !componentLibrary.folders) {
        return favoritesFolder;
      }

      const uniqueLibraryComponents = filterToUniqueByDigest(
        flattenFolders(componentLibrary),
      );

      for (const component of uniqueLibraryComponents) {
        if (await isFavoriteComponent(component)) {
          favoritesFolder.components?.push(component);
        }
      }

      return favoritesFolder;
    },
    enabled: Boolean(componentLibrary),
    staleTime: 10 * MINUTES,
  });

  const favoritesFolder = useMemo(
    () =>
      favoritesFolderData ?? {
        name: "Favorite Components",
        components: [],
        folders: [],
        isUserFolder: false,
      },
    [favoritesFolderData],
  );

  // Methods
  const refreshComponentLibrary = useCallback(async () => {
    const { data: updatedLibrary } = await refetchLibrary();

    if (updatedLibrary) {
      setComponentLibrary(updatedLibrary);
      await refetchFavorites();
    }
  }, [refetchLibrary, refetchFavorites]);

  const refreshUserComponents = useCallback(async () => {
    const { data: updatedUserComponents } = await refetchUserComponents();

    if (updatedUserComponents) {
      populateComponentRefs(updatedUserComponents).then((result) => {
        setUserComponentsFolder(result);
      });
    }
  }, [refetchUserComponents]);

  const setComponentFavorite = useCallback(
    async (component: ComponentReference, favorited: boolean) => {
      // Update via filename (User Components)
      if (!component.url && component.name) {
        component.favorited = favorited;

        if (component.spec) {
          await updateComponentRefInList(
            USER_COMPONENTS_LIST_NAME,
            component as ComponentReferenceWithSpec,
            component.name,
          ).then(async () => {
            await refreshUserComponents();
          });
        } else if (component.text) {
          await updateComponentInListByText(
            USER_COMPONENTS_LIST_NAME,
            component.text,
            component.name,
            { favorited },
          ).then(async () => {
            await refreshUserComponents();
          });
        } else {
          console.warn(
            `Component "${
              component.name
            }" does not have spec or text, cannot favorite.`,
          );
        }

        return;
      }

      if (!component.url) {
        console.warn(
          `Component "${component.name}" does not have a url, cannot favorite.`,
        );
        return;
      }

      // Update via url (Standard Components)
      const storedComponent = await getComponentByUrl(component.url);

      if (storedComponent) {
        await saveComponent({
          ...storedComponent,
          favorited,
        }).then(async () => {
          await refreshComponentLibrary();
          await refreshUserComponents();
        });
      }
    },
    [refreshComponentLibrary, refreshUserComponents],
  );

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

  const checkLibraryContainsComponent = useCallback(
    (component: ComponentReference) => {
      if (!componentLibrary) return false;

      if (checkIfUserComponent(component)) return true;

      const uniqueComponents = filterToUniqueByDigest(
        flattenFolders(componentLibrary),
      );

      return uniqueComponents.some((c) => c.digest === component.digest);
    },
    [componentLibrary, checkIfUserComponent],
  );

  /**
   * Local component library search
   */
  const searchComponentLibrary = useCallback(
    (search: string, filters: string[]) => {
      if (!search.trim()) return null;

      const result: SearchResult = {
        components: {
          standard: [],
          user: [],
          used: [],
        },
      };

      if (componentLibrary) {
        const uniqueComponents = filterToUniqueByDigest(
          flattenFolders(componentLibrary),
        );

        result.components.standard = uniqueComponents.filter(
          (c) => c.spec && componentMatchesSearch(c.spec, search, filters),
        );
      }

      if (userComponentsFolder) {
        const uniqueComponents = filterToUniqueByDigest(
          flattenFolders(userComponentsFolder),
        );
        result.components.user = uniqueComponents.filter(
          (c) => c.spec && componentMatchesSearch(c.spec, search, filters),
        );
      }

      if (usedComponentsFolder) {
        const uniqueComponents = filterToUniqueByDigest(
          flattenFolders(usedComponentsFolder),
        );
        result.components.used = uniqueComponents.filter(
          (c) => c.spec && componentMatchesSearch(c.spec, search, filters),
        );
      }

      return result;
    },
    [componentLibrary, userComponentsFolder, usedComponentsFolder],
  );

  const internalAddComponentToLibrary = useCallback(
    async (hydratedComponent: HydratedComponentReference) => {
      await importComponent(hydratedComponent);
      await refreshComponentLibrary();
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
    [refreshComponentLibrary, refreshUserComponents, importComponent],
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
    [
      newComponent,
      refreshComponentLibrary,
      refreshUserComponents,
      importComponent,
    ],
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
    [
      userComponentsFolder,
      refreshComponentLibrary,
      refreshUserComponents,
      importComponent,
    ],
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
            await refreshComponentLibrary();
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
    [refreshComponentLibrary, refreshUserComponents],
  );

  const handleCloseDuplicationDialog = useCallback(() => {
    setExistingComponent(null);
    setNewComponent(null);

    dispatchEvent(new CustomEvent("tangle.library.duplicateDialogClosed"));
  }, []);

  const searchResult = useMemo(
    () =>
      searchComponentLibrary(
        currentSearchFilter.searchTerm,
        currentSearchFilter.filters,
      ),
    [currentSearchFilter, searchComponentLibrary],
  );

  useEffect(() => {
    if (!rawComponentLibrary) {
      setComponentLibrary(undefined);
      return;
    }
    setComponentLibrary(rawComponentLibrary);
  }, [rawComponentLibrary]);

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

  const isLoading = isLibraryLoading || isUserComponentsLoading;
  const error = libraryError || userComponentsError;

  const value = useMemo(
    () => ({
      componentLibrary,
      userComponentsFolder,
      usedComponentsFolder,
      favoritesFolder,
      isLoading,
      error,
      searchResult,
      existingComponentLibraries,
      searchComponentLibrary,
      getComponentLibrary,
      addToComponentLibrary,
      removeFromComponentLibrary,
      setComponentFavorite,
      checkIfUserComponent,
      checkLibraryContainsComponent,
    }),
    [
      componentLibrary,
      userComponentsFolder,
      usedComponentsFolder,
      favoritesFolder,
      isLoading,
      error,
      searchResult,
      existingComponentLibraries,
      searchComponentLibrary,
      getComponentLibrary,
      addToComponentLibrary,
      removeFromComponentLibrary,
      setComponentFavorite,
      checkIfUserComponent,
      checkLibraryContainsComponent,
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
