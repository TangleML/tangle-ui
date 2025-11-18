import { COMPONENT_LIBRARY_URL } from "@/services/componentService";

import { LibraryDB, type StoredLibraryItem } from "./storage";
import { YamlFileLibrary } from "./yamlFileLibrary";

export const FAVORITE_COMPONENTS_LIBRARY_ID = "favorite_components";

export async function migrateLegacyFavoriteFolder() {
  /**
   * Migrate the favorite components to the new database
   */
  const yamlLibrary = new YamlFileLibrary(
    "Standard Components",
    COMPONENT_LIBRARY_URL,
  );

  const searchResult = await yamlLibrary.getComponents({
    filters: ["all"],
    searchTerm: "*",
  });

  const favoriteComponents =
    searchResult.components
      ?.filter((component) => component.favorited)
      .map(
        (component) =>
          ({
            digest: component.digest,
            name: component.name,
            url: component.url,
          }) as StoredLibraryItem,
      ) ?? [];

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
