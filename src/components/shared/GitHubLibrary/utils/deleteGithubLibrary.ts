import {
  LibraryDB,
  type StoredLibrary,
} from "@/providers/ComponentLibraryProvider/libraries/storage";

export async function deleteGithubLibrary(library: StoredLibrary) {
  const existingLibrary = await LibraryDB.component_libraries.get(library.id);

  if (!existingLibrary) {
    throw new Error(`Library ${library.id} not found`);
  }

  await LibraryDB.component_libraries.delete(library.id);

  return true;
}
