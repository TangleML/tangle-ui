import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ComponentDuplicateDialog from "@/components/shared/Dialogs/ComponentDuplicateDialog";
import {
  COMPONENT_LIBRARY_URL,
  fetchAndStoreComponentLibrary,
} from "@/services/componentService";
import type {
  ComponentFolder,
  ComponentLibrary,
  SearchResult,
} from "@/types/componentLibrary";
import type { ComponentReference } from "@/utils/componentSpec";
import {
  type ComponentReferenceWithSpec,
  deleteComponentFileFromList,
  importComponent,
  updateComponentInListByText,
  updateComponentRefInList,
} from "@/utils/componentStore";
import { USER_COMPONENTS_LIST_NAME } from "@/utils/constants";
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
  fetchFavoriteComponents,
  fetchUsedComponents,
  fetchUserComponents,
  filterToUniqueByDigest,
  flattenFolders,
  populateComponentRefs,
} from "./componentLibrary";
import { useForcedSearchContext } from "./ForcedSearchProvider";
import { BrowserPersistedLibrary } from "./libraries/browserPersistedLibrary";
import { GraphSpecReadonlyLibrary } from "./libraries/graphSpecReadonlyLibrary";
import {
  FAVORITE_COMPONENTS_LIBRARY_ID,
  migrateLegacyFavoriteFolder,
} from "./libraries/migrateLegacyFavoriteFolder";
import { PublishedComponentsLibrary } from "./libraries/publishedComponentsLibrary";
import type { Library } from "./libraries/types";
import { YamlFileLibrary } from "./libraries/yamlFileLibrary";

type AvailableComponentLibraries =
  | "published_components"
  | "favorite_components"
  | "used_components"
  | "standard_components";

type ComponentLibraryContextType = {
  componentLibrary: ComponentLibrary | undefined;
  userComponentsFolder: ComponentFolder | undefined;
  usedComponentsFolder: ComponentFolder;
  favoritesFolder: ComponentFolder;
  isLoading: boolean;
  error: Error | null;

  searchResult: SearchResult | null;

  highlightedComponentDigest: string | null;
  searchComponentLibrary: (
    search: string,
    filters: string[],
  ) => SearchResult | null;
  addToComponentLibrary: (component: ComponentReference) => void;
  removeFromComponentLibrary: (component: ComponentReference) => void;
  refetchLibrary: () => void;
  refetchUserComponents: () => void;

  setHighlightedComponentDigest: (digest: string | null) => void;
  setComponentFavorite: (
    component: ComponentReference,
    favorited: boolean,
  ) => void;
  checkIfFavorited: (component: ComponentReference) => boolean;
  checkIfUserComponent: (component: ComponentReference) => boolean;
  checkLibraryContainsComponent: (component: ComponentReference) => boolean;
  checkIfHighlighted: (component: ComponentReference) => boolean;

  getComponentLibrary: (libraryName: AvailableComponentLibraries) => Library;
};

const ComponentLibraryContext =
  createRequiredContext<ComponentLibraryContextType>(
    "ComponentLibraryProvider",
  );

export const ComponentLibraryProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { graphSpec } = useComponentSpec();
  const { currentSearchFilter } = useForcedSearchContext();
  const queryClient = useQueryClient();

  const componentLibraries = useMemo(
    () =>
      new Map<AvailableComponentLibraries, Library>([
        ["published_components", new PublishedComponentsLibrary(queryClient)],
        [
          FAVORITE_COMPONENTS_LIBRARY_ID,
          new BrowserPersistedLibrary(
            FAVORITE_COMPONENTS_LIBRARY_ID,
            migrateLegacyFavoriteFolder,
          ),
        ],
        [
          "standard_components",
          new YamlFileLibrary("Standard library", COMPONENT_LIBRARY_URL),
        ],
        [
          "used_components",
          new GraphSpecReadonlyLibrary("Used components", undefined),
        ],
      ]),
    [queryClient],
  );

  const getComponentLibraryObject = useCallback(
    (libraryName: AvailableComponentLibraries) => {
      if (!componentLibraries.has(libraryName)) {
        throw new Error(`Component library "${libraryName}" is not supported.`);
      }

      return componentLibraries.get(libraryName) as Library;
    },
    [componentLibraries],
  );

  useEffect(() => {
    // kinda hacky yet
    const usedComponentsLibrary = componentLibraries.get("used_components");
    if (usedComponentsLibrary) {
      (usedComponentsLibrary as GraphSpecReadonlyLibrary).setGraphSpec(
        graphSpec,
      );
    }
  }, [graphSpec]);

  const [componentLibrary, setComponentLibrary] = useState<ComponentLibrary>();
  const [userComponentsFolder, setUserComponentsFolder] =
    useState<ComponentFolder>();

  const [highlightedComponentDigest, setHighlightedComponentDigest] = useState<
    string | null
  >(null);

  const [existingComponent, setExistingComponent] =
    useState<UserComponent | null>(null);
  const [newComponent, setNewComponent] = useState<ComponentReference | null>(
    null,
  );

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
  const favoritesFolder: ComponentFolder = useMemo(
    () => fetchFavoriteComponents(componentLibrary),
    [componentLibrary],
  );

  // Methods
  const refreshComponentLibrary = useCallback(async () => {
    const { data: updatedLibrary } = await refetchLibrary();

    if (updatedLibrary) {
      populateComponentRefs(updatedLibrary).then((result) => {
        setComponentLibrary(result);
      });
    }
  }, [refetchLibrary]);

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

  const checkIfFavorited = useCallback(
    (component: ComponentReference) => {
      if (componentLibrary) {
        const uniqueLibraryComponents = filterToUniqueByDigest(
          flattenFolders(componentLibrary),
        );

        const isFavourited = uniqueLibraryComponents.some(
          (c) => c.digest === component.digest && c.favorited,
        );

        if (isFavourited) {
          return true;
        }
      }

      if (userComponentsFolder) {
        const uniqueUserComponents = filterToUniqueByDigest(
          flattenFolders(userComponentsFolder),
        );

        const isFavourited = uniqueUserComponents.some(
          (c) => c.digest === component.digest && c.favorited,
        );

        if (isFavourited) {
          return true;
        }
      }

      return false;
    },
    [componentLibrary, userComponentsFolder],
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

  const checkIfHighlighted = useCallback(
    (component: ComponentReference) => {
      return component.digest === highlightedComponentDigest;
    },
    [highlightedComponentDigest],
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

  const handleImportComponent = useCallback(
    async (yamlString: string) => {
      const component = { ...newComponent, text: yamlString };

      await importComponent(component)
        .then(async () => {
          await refreshComponentLibrary();
          await refreshUserComponents();
          setNewComponent(null);
          setExistingComponent(null);
        })
        .catch((error) => {
          console.error("Error importing component:", error);
        });
    },
    [
      refreshUserComponents,
      refreshComponentLibrary,
      importComponent,
      newComponent,
    ],
  );

  const addToComponentLibrary = useCallback(
    async (component: ComponentReference) => {
      const duplicate = userComponentsFolder
        ? flattenFolders(userComponentsFolder).find(
            (c) => getComponentName(c) === getComponentName(component),
          )
        : undefined;

      if (duplicate?.name) {
        const existingUserComponent = await getUserComponentByName(
          duplicate.name,
        );
        setExistingComponent(existingUserComponent);
        setNewComponent(component);
        return;
      }

      await importComponent(component)
        .then(async () => {
          await refreshComponentLibrary();
          await refreshUserComponents();
        })
        .catch((error) => {
          console.error("Error adding component to library:", error);
        });
    },
    [
      userComponentsFolder,
      refreshComponentLibrary,
      refreshUserComponents,
      importComponent,
    ],
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
    populateComponentRefs(rawComponentLibrary).then((result) => {
      setComponentLibrary(result);
    });
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
      highlightedComponentDigest,
      searchComponentLibrary,
      getComponentLibrary,
      addToComponentLibrary,
      removeFromComponentLibrary,
      refetchLibrary,
      refetchUserComponents,
      setHighlightedComponentDigest,
      setComponentFavorite,
      checkIfFavorited,
      checkIfUserComponent,
      checkLibraryContainsComponent,
      checkIfHighlighted,
    }),
    [
      componentLibrary,
      userComponentsFolder,
      usedComponentsFolder,
      favoritesFolder,
      isLoading,
      error,
      searchResult,
      highlightedComponentDigest,
      searchComponentLibrary,
      getComponentLibrary,
      addToComponentLibrary,
      removeFromComponentLibrary,
      refetchLibrary,
      refetchUserComponents,
      setHighlightedComponentDigest,
      setComponentFavorite,
      checkIfFavorited,
      checkIfUserComponent,
      checkLibraryContainsComponent,
      checkIfHighlighted,
    ],
  );

  return (
    <ComponentLibraryContext.Provider value={value}>
      {children}
      <ComponentDuplicateDialog
        existingComponent={existingComponent ?? undefined}
        newComponent={newComponent?.spec}
        newComponentDigest={newComponent?.digest}
        setClose={handleCloseDuplicationDialog}
        handleImportComponent={handleImportComponent}
      />
    </ComponentLibraryContext.Provider>
  );
};

export const useComponentLibrary = () => {
  return useRequiredContext(ComponentLibraryContext);
};
