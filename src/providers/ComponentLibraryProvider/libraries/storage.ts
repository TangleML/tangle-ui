import Dexie, { type EntityTable } from "dexie";

const DB_NAME = "oasis-app";
const DEXIE_EPOCH = 0;

export interface StoredLibraryItem {
  digest: string;
  name: string;
  url?: string;
}

interface StoredLibraryFolder {
  name: string;
  folders?: StoredLibraryFolder[];
  components?: StoredLibraryItem[];
}

export interface StoredLibrary extends StoredLibraryFolder {
  id: string;
  icon?: string;
  /**
   * yaml - a yaml file that contains the components
   * indexdb - a local database that contains the components. filled only by the Oasis App
   * pinned - a pinned libraries from the Backend API
   * github - a github repository that contains the components
   */
  type: "yaml" | "indexdb" | "pinned" | "github";

  configuration?: Record<string, unknown>;
  knownDigests: string[];
}

export const LibraryDB = new Dexie(DB_NAME) as Dexie & {
  component_libraries: EntityTable<StoredLibrary, "id">;
};

/**
 * Initialize the database with the favorite components
 * Each version should be declared in DEXIE_EPOCH + {number}, starting from 1
 */
LibraryDB.version(DEXIE_EPOCH + 1).stores({
  // id - primary key; name is unique index
  component_libraries: "id, &name",
});
