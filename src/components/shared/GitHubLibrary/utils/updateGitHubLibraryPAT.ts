import {
  LibraryDB,
  type StoredLibrary,
} from "@/providers/ComponentLibraryProvider/libraries/storage";

export async function updateGitHubLibraryPAT(
  library: StoredLibrary,
  accessToken: string,
) {
  const existingLibrary = await LibraryDB.component_libraries.get(library.id);

  if (!existingLibrary) {
    throw new Error(`Library ${library.id} not found`);
  }

  return (
    // @ts-expect-error dexie has some issues with nested types, tmp patch here
    (await LibraryDB.component_libraries.update(library.id, {
      "configuration.access_token": accessToken,
    })) === 1
  );
}
