import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { computed } from "mobx";
import { observer } from "mobx-react-lite";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ComponentDuplicateDialog from "@/components/shared/Dialogs/ComponentDuplicateDialog";
import { getComponentQueryKey } from "@/hooks/useHydrateComponentReference";
import { collectUsedComponentReferences } from "@/models/componentSpec/collectUsedComponentReferences";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useBackend } from "@/providers/BackendProvider";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import {
  standardComponentLibraryQuery,
  userComponentsQuery,
} from "@/services/componentSearchCatalog";
import { hydrateComponentReference } from "@/services/componentService";
import type {
  ComponentFolder,
  ComponentLibrary,
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
import { type ComponentLibraryEntryPoint } from "@/utils/componentTracking";
import { MINUTES, USER_COMPONENTS_LIST_NAME } from "@/utils/constants";
import { createPromiseFromDomEvent } from "@/utils/dom";
import { getComponentName } from "@/utils/getComponentName";
import {
  getComponentByUrl,
  getUserComponentByName,
  saveComponent,
  type UserComponent,
} from "@/utils/localforage";

import {
  createRequiredContext,
  useRequiredContext,
} from "../../hooks/useRequiredContext";
import {
  filterToUniqueByDigest,
  flattenFolders,
  isFavoriteComponent,
  populateComponentRefs,
} from "./componentLibrary";
import { createLibraryObject } from "./libraries/factory";
import { PublishedComponentsLibrary } from "./libraries/publishedComponentsLibrary";
import { ensureLibraryFactoriesRegistered } from "./libraries/setup";
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

  addToComponentLibrary: (
    component: HydratedComponentReference,
    entryPoint?: ComponentLibraryEntryPoint,
  ) => Promise<HydratedComponentReference | undefined>;
  removeFromComponentLibrary: (
    component: ComponentReference,
    entryPoint?: ComponentLibraryEntryPoint,
  ) => Promise<void>;
  setComponentFavorite: (
    component: ComponentReference,
    favorited: boolean,
  ) => void;
  checkIfUserComponent: (component: ComponentReference) => boolean;

  getComponentLibrary: (libraryName: AvailableComponentLibraries) => Library;
};

const ComponentLibraryContext =
  createRequiredContext<ComponentLibraryContextType>(
    "ComponentLibraryProvider",
  );

// Register library factories at module load. The same helper is also called
// from places that read libraries from Dexie without mounting this provider
// (e.g. the dashboard search page), so the factory body stays in exactly one
// place — see `./libraries/setup`.
ensureLibraryFactoriesRegistered();

function useComponentLibraryRegistry() {
  const queryClient = useQueryClient();
  const { backendUrl } = useBackend();
  const existingComponentLibraries = useLiveQuery(() =>
    LibraryDB.component_libraries.toArray(),
  );
  const componentLibraries = useMemo(() => {
    const libraries = new Map<AvailableComponentLibraries, Library>([
      [
        "published_components",
        new PublishedComponentsLibrary(queryClient, backendUrl),
      ],
    ]);
    for (const library of existingComponentLibraries ?? []) {
      libraries.set(library.id, createLibraryObject(library));
    }
    return libraries;
  }, [queryClient, backendUrl, existingComponentLibraries]);

  const getComponentLibrary = useCallback(
    (libraryName: AvailableComponentLibraries) => {
      if (!componentLibraries.has(libraryName)) {
        throw new Error(`Component library "${libraryName}" is not found.`);
      }

      return componentLibraries.get(libraryName) as Library;
    },
    [componentLibraries],
  );

  return { getComponentLibrary, existingComponentLibraries };
}

export const ComponentLibraryProvider = observer(
  function ComponentLibraryProvider({ children }: { children: ReactNode }) {
    const { navigation } = useSharedStores();
    const queryClient = useQueryClient();
    const { track } = useAnalytics();

    const { getComponentLibrary, existingComponentLibraries } =
      useComponentLibraryRegistry();

    const [userComponentsFolder, setUserComponentsFolder] =
      useState<ComponentFolder>();

    const [existingComponent, setExistingComponent] =
      useState<UserComponent | null>(null);
    const [newComponent, setNewComponent] =
      useState<HydratedComponentReference | null>(null);

    const {
      data: componentLibrary,
      isLoading: isLibraryLoading,
      error: libraryError,
      refetch: refetchLibrary,
    } = useQuery(standardComponentLibraryQuery);

    const {
      data: rawUserComponentsFolder,
      isLoading: isUserComponentsLoading,
      error: userComponentsError,
      refetch: refetchUserComponents,
    } = useQuery(userComponentsQuery);

    const usedComponentsFolder: ComponentFolder = useMemo(
      () =>
        computed(() => ({
          name: "Used in Pipeline",
          components: navigation.activeSpec
            ? collectUsedComponentReferences(navigation.activeSpec)
            : [],
          folders: [],
          isUserFolder: false,
        })),
      [navigation],
    ).get();

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

    const refreshComponentLibrary = useCallback(async () => {
      const { data: updatedLibrary } = await refetchLibrary();

      if (updatedLibrary) {
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

    const internalAddComponentToLibrary = useCallback(
      async (hydratedComponent: HydratedComponentReference) => {
        await importComponent(hydratedComponent);

        queryClient.invalidateQueries({
          queryKey: [
            "component",
            "hydrate",
            getComponentQueryKey(hydratedComponent),
          ],
        });

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
        entryPoint: ComponentLibraryEntryPoint = "unknown",
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

        const succeeded =
          result instanceof CustomEvent &&
          result.type === "tangle.library.componentAdded";
        if (succeeded) {
          track("component_library.added", {
            component_id: hydratedComponentRef.digest,
            component_name: getComponentName(hydratedComponentRef),
            entry_point: entryPoint,
          });
        }

        return succeeded ? hydratedComponentRef : undefined;
      },
      [addToComponentLibraryWithDuplicateCheck, track],
    );

    const removeFromComponentLibrary = useCallback(
      async (
        component: ComponentReference,
        entryPoint: ComponentLibraryEntryPoint = "unknown",
      ) => {
        try {
          if (component.name) {
            await deleteComponentFileFromList(
              USER_COMPONENTS_LIST_NAME,
              component.name,
            ).then(async () => {
              await refreshComponentLibrary();
              await refreshUserComponents();
            });
            track("component_library.removed", {
              component_id: component.digest,
              component_name: getComponentName(component),
              entry_point: entryPoint,
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
      [refreshComponentLibrary, refreshUserComponents, track],
    );

    const handleCloseDuplicationDialog = useCallback(() => {
      setExistingComponent(null);
      setNewComponent(null);

      dispatchEvent(new CustomEvent("tangle.library.duplicateDialogClosed"));
    }, []);

    useEffect(() => {
      if (!rawUserComponentsFolder) {
        setUserComponentsFolder(undefined);
        return;
      }
      populateComponentRefs(rawUserComponentsFolder).then((result) => {
        setUserComponentsFolder(result);
      });
    }, [rawUserComponentsFolder]);

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
        existingComponentLibraries,
        getComponentLibrary,
        addToComponentLibrary,
        removeFromComponentLibrary,
        setComponentFavorite,
        checkIfUserComponent,
      }),
      [
        componentLibrary,
        userComponentsFolder,
        usedComponentsFolder,
        favoritesFolder,
        isLoading,
        error,
        existingComponentLibraries,
        getComponentLibrary,
        addToComponentLibrary,
        removeFromComponentLibrary,
        setComponentFavorite,
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
  },
);

export const useComponentLibrary = () => {
  return useRequiredContext(ComponentLibraryContext);
};
