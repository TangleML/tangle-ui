import type { StoredLibrary } from "./storage";
import type { Library } from "./types";

type FactoryMethod = (library: StoredLibrary) => Library;

class UnsupportedLibraryTypeError extends Error {
  name = "UnsupportedLibraryTypeError";
  constructor(message: string) {
    super(message);
  }
}

const knownLibraries = new Map<string, FactoryMethod>([]);

export function registerLibraryFactory(type: string, factory: FactoryMethod) {
  knownLibraries.set(type, factory);
}

/**
 * Create a library object for a given library.
 * @param library - The library to create an object for.
 * @returns The created library object.
 */
export function createLibraryObject(library: StoredLibrary) {
  const factory = knownLibraries.get(library.type);
  if (!factory) {
    throw new UnsupportedLibraryTypeError(
      `Unsupported library type: ${library.type}`,
    );
  }
  return factory(library);
}
