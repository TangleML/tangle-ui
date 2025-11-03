import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useEffectEvent, useState } from "react";

import ComponentDuplicateDialog from "@/components/shared/Dialogs/ComponentDuplicateDialog";
import { fetchAndStoreComponentLibrary } from "@/services/componentService";
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
import { PublishedComponentsLibrary } from "./libraries/publishedComponentsLibrary";
import type { Library } from "./libraries/types";

type AvailableComponentLibraries = "published_components";

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

  const componentLibraries = new Map<AvailableComponentLibraries, Library>([
    ["published_components", new PublishedComponentsLibrary(queryClient)],
  ]);

  const getComponentLibraryObject = (
    libraryName: AvailableComponentLibraries,
  ) => {
    if (!componentLibraries.has(libraryName)) {
      throw new Error(`Component library "${libraryName}" is not supported.`);
    }

    return componentLibraries.get(libraryName) as Library;
  };

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
  const usedComponentsFolder: ComponentFolder = fetchUsedComponents(graphSpec);

  // Fetch "Starred" components
  const favoritesFolder: ComponentFolder =
    fetchFavoriteComponents(componentLibrary);

  // Methods
  const refreshComponentLibrary = async () => {
    const { data: updatedLibrary } = await refetchLibrary();

    if (updatedLibrary) {
      populateComponentRefs(updatedLibrary).then((result) => {
        setComponentLibrary(result);
      });
    }
  };

  const refreshUserComponents = async () => {
    const { data: updatedUserComponents } = await refetchUserComponents();

    if (updatedUserComponents) {
      populateComponentRefs(updatedUserComponents).then((result) => {
        setUserComponentsFolder(result);
      });
    }
  };

  const setComponentFavorite = async (
    component: ComponentReference,
    favorited: boolean,
  ) => {
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
  };

  const checkIfFavorited = (component: ComponentReference) => {
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
  };

  const checkIfUserComponent = (component: ComponentReference) => {
    if (!userComponentsFolder) return false;

    const uniqueUserComponents = filterToUniqueByDigest(
      flattenFolders(userComponentsFolder),
    );

    return uniqueUserComponents.some((c) => c.digest === component.digest);
  };

  const checkLibraryContainsComponent = (component: ComponentReference) => {
    if (!componentLibrary) return false;

    if (checkIfUserComponent(component)) return true;

    const uniqueComponents = filterToUniqueByDigest(
      flattenFolders(componentLibrary),
    );

    return uniqueComponents.some((c) => c.digest === component.digest);
  };

  const checkIfHighlighted = (component: ComponentReference) => {
    return component.digest === highlightedComponentDigest;
  };

  /**
   * Local component library search
   */
  const searchComponentLibrary = (search: string, filters: string[]) => {
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
  };

  const handleImportComponent = async (yamlString: string) => {
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
  };

  const addToComponentLibrary = async (component: ComponentReference) => {
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
  };

  const removeFromComponentLibrary = async (component: ComponentReference) => {
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
  };

  const handleCloseDuplicationDialog = () => {
    setExistingComponent(null);
    setNewComponent(null);
  };

  const searchResult = searchComponentLibrary(
    currentSearchFilter.searchTerm,
    currentSearchFilter.filters,
  );

  const updateComponentLibrary = useEffectEvent(
    (library: ComponentLibrary | undefined) => {
      setComponentLibrary(library);
    },
  );

  const updateUserComponentsFolder = useEffectEvent(
    (folder: ComponentFolder | undefined) => {
      setUserComponentsFolder(folder);
    },
  );

  useEffect(() => {
    if (!rawComponentLibrary) {
      updateComponentLibrary(undefined);
      return;
    }
    populateComponentRefs(rawComponentLibrary).then((result) => {
      updateComponentLibrary(result);
    });
  }, [rawComponentLibrary]);

  useEffect(() => {
    if (!rawUserComponentsFolder) {
      updateUserComponentsFolder(undefined);
      return;
    }
    populateComponentRefs(rawUserComponentsFolder).then((result) => {
      updateUserComponentsFolder(result);
    });
  }, [rawUserComponentsFolder]);

  const getComponentLibrary = (libraryName: AvailableComponentLibraries) => {
    return getComponentLibraryObject(libraryName);
  };

  const isLoading = isLibraryLoading || isUserComponentsLoading;
  const error = libraryError || userComponentsError;

  const value = {
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
  };

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
