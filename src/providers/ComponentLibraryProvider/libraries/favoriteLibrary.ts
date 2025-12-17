import { hydrateComponentReference } from "@/services/componentService";
import { iterateOverAllComponents } from "@/utils/localforage";

import { BrowserPersistedLibrary } from "./browserPersistedLibrary";
import { LibraryDB, type StoredLibraryItem } from "./storage";

const FAVORITE_COMPONENTS_LIBRARY_ID = "favorite_components";

export class FavoriteLibrary extends BrowserPersistedLibrary {
  constructor() {
    super(FAVORITE_COMPONENTS_LIBRARY_ID, () => migrateLegacyFavoriteFolder());
  }
}

/**
 * Migrate the favorite components to the new database.
 * This action supposed to happen only once.
 *
 * @returns
 */
async function migrateLegacyFavoriteFolder() {
  /**
   * Migrate the favorite components to the new database
   */
  const favoriteComponents: StoredLibraryItem[] = [];
  await iterateOverAllComponents(async (component) => {
    if (component.favorited) {
      console.log(
        `Migrating component ${component.id} to favorite library. Favorited: ${component.favorited}`,
        component,
      );

      const hydratedComponent = await hydrateComponentReference({
        url: component.url,
        text: component.data,
      });

      if (!hydratedComponent) {
        console.error(
          `Failed to migrate component "${component.id}" to favorite library`,
          component,
        );
        return;
      }

      favoriteComponents.push({
        digest: hydratedComponent.digest,
        name: hydratedComponent.name,
        url: hydratedComponent.url,
      } as StoredLibraryItem);
    }
  });

  await LibraryDB.component_libraries.put({
    id: FAVORITE_COMPONENTS_LIBRARY_ID,
    name: "Favorite Components",
    icon: "Star",
    type: "indexdb",
    knownDigests: favoriteComponents.map((component) => component.digest),
    configuration: {
      migrated_at: new Date().toISOString(),
    },
    components: favoriteComponents,
  });

  return await LibraryDB.component_libraries.get(
    FAVORITE_COMPONENTS_LIBRARY_ID,
  );
}
