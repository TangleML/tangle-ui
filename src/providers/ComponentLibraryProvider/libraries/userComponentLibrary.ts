import { hydrateComponentReference } from "@/services/componentService";
import { isHydratedComponentReference } from "@/utils/componentSpec";
import { getAllUserComponents } from "@/utils/localforage";

import { BrowserPersistedLibrary } from "./browserPersistedLibrary";
import { LibraryDB, type StoredLibraryItem } from "./storage";

const USER_COMPONENTS_LIBRARY_ID = "user_components";

export class UserComponentsLibrary extends BrowserPersistedLibrary {
  constructor() {
    super(USER_COMPONENTS_LIBRARY_ID, () =>
      migrateLegacyUserComponentsFolder(),
    );
  }
}

/**
 * Migrate the favorite components to the new database.
 * This action supposed to happen only once.
 *
 * @returns
 */
async function migrateLegacyUserComponentsFolder() {
  /**
   * Migrate the favorite components to the new database
   */
  const allComponents = await getAllUserComponents();
  const userComponents: StoredLibraryItem[] = (
    await Promise.all([
      ...allComponents.map((c) => hydrateComponentReference(c.componentRef)),
    ])
  )
    .filter(isHydratedComponentReference)
    .map((component) => ({
      digest: component.digest,
      name: component.name,
      url: component.url,
    }));

  await LibraryDB.component_libraries.put({
    id: USER_COMPONENTS_LIBRARY_ID,
    name: "User Components",
    icon: "Puzzle",
    type: "indexdb",
    knownDigests: userComponents.map((component) => component.digest),
    configuration: {
      migrated_at: new Date().toISOString(),
    },
    components: userComponents,
  });

  return await LibraryDB.component_libraries.get(USER_COMPONENTS_LIBRARY_ID);
}
