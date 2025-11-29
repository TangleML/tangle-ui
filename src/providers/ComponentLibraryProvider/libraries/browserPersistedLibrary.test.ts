import "fake-indexeddb/auto";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { ComponentReference } from "@/utils/componentSpec";

import { BrowserPersistedLibrary } from "./browserPersistedLibrary";
import { LibraryDB, type StoredLibrary } from "./storage";

vi.mock("@/services/componentService", () => ({
  hydrateComponentReference: vi.fn(),
  fetchComponentTextFromUrl: vi.fn(),
}));

vi.mock("@/services/componentStore", () => ({
  generateDigest: vi.fn(),
}));

describe("BrowserPersistedLibrary", () => {
  const createMockComponentReference = (
    name = "test-component",
    digest = "test-digest-123",
  ): ComponentReference => ({
    name,
    digest,
    url: `https://example.com/${name}.yaml`,
  });

  const createMockStoredLibrary = (
    id: string,
    name: string,
    components: ComponentReference[] = [],
  ): StoredLibrary => ({
    id,
    name,
    type: "indexdb",
    knownDigests: components.map((c) => c.digest).filter(Boolean) as string[],
    components: components as StoredLibrary["components"],
    folders: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up IndexedDB after each test
    await LibraryDB.component_libraries.clear();
  });

  describe("createLibrary method", () => {
    it("should call createLibrary function when library is not found in database", async () => {
      // Arrange
      const libraryId = "new-library-id";
      const mockLibrary = createMockStoredLibrary(libraryId, "Test Library", [
        createMockComponentReference(),
      ]);
      const createLibrarySpy = vi.fn().mockResolvedValue(mockLibrary);

      // Ensure library doesn't exist in database
      const existingLibrary =
        await LibraryDB.component_libraries.get(libraryId);
      expect(existingLibrary).toBeUndefined();

      // Act
      const library = new BrowserPersistedLibrary(libraryId, createLibrarySpy);

      // Wait for the library to finish loading
      const components = await library.getComponents();

      // Assert
      expect(createLibrarySpy).toHaveBeenCalledTimes(1);
      expect(components).toEqual({
        name: libraryId, // When library is created but not in DB, it uses the ID as fallback
        components: [
          expect.objectContaining({
            name: "test-component",
            digest: "test-digest-123",
            url: "https://example.com/test-component.yaml",
          }),
        ],
        folders: [],
      });
    });

    it("should not call createLibrary function when library exists in database", async () => {
      // Arrange
      const libraryId = "existing-library-id";
      const existingLibrary = createMockStoredLibrary(
        libraryId,
        "Existing Library",
        [createMockComponentReference("existing-component", "existing-digest")],
      );
      const createLibrarySpy = vi.fn();

      // Add library to database first
      await LibraryDB.component_libraries.add(existingLibrary);

      // Act
      const library = new BrowserPersistedLibrary(libraryId, createLibrarySpy);

      // Wait for the library to finish loading
      const components = await library.getComponents();

      // Assert
      expect(createLibrarySpy).not.toHaveBeenCalled();
      expect(components).toEqual({
        name: "Existing Library",
        components: [
          expect.objectContaining({
            name: "existing-component",
            digest: "existing-digest",
            url: "https://example.com/existing-component.yaml",
          }),
        ],
        folders: [],
      });
    });

    it("should throw error when createLibrary returns undefined and library not in database", async () => {
      // Arrange
      const libraryId = "missing-library-id";
      const createLibrarySpy = vi.fn().mockResolvedValue(undefined);

      // Act
      const library = new BrowserPersistedLibrary(libraryId, createLibrarySpy);

      // Assert
      await expect(library.getComponents()).rejects.toThrow(
        `Library ${libraryId} not found`,
      );
      expect(createLibrarySpy).toHaveBeenCalledTimes(1);
    });

    it("should handle empty components list from createLibrary", async () => {
      // Arrange
      const libraryId = "empty-library-id";
      const mockLibrary = createMockStoredLibrary(
        libraryId,
        "Empty Library",
        [],
      );
      const createLibrarySpy = vi.fn().mockResolvedValue(mockLibrary);

      // Act
      const library = new BrowserPersistedLibrary(libraryId, createLibrarySpy);
      const components = await library.getComponents();

      // Assert
      expect(createLibrarySpy).toHaveBeenCalledTimes(1);
      expect(components).toEqual({
        name: libraryId, // When library is created but not in DB, it uses the ID as fallback
        components: [],
        folders: [],
      });
    });

    it("should create library with multiple valid components", async () => {
      // Arrange
      const libraryId = "multi-component-library";
      const mockLibrary = createMockStoredLibrary(
        libraryId,
        "Multi Component Library",
        [
          createMockComponentReference("component-1", "digest-1"),
          createMockComponentReference("component-2", "digest-2"),
        ],
      );
      const createLibrarySpy = vi.fn().mockResolvedValue(mockLibrary);

      // Act
      const library = new BrowserPersistedLibrary(libraryId, createLibrarySpy);
      const components = await library.getComponents();

      // Assert
      expect(createLibrarySpy).toHaveBeenCalledTimes(1);
      expect(components.components).toHaveLength(2);
      expect(components.components).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ digest: "digest-1", name: "component-1" }),
          expect.objectContaining({ digest: "digest-2", name: "component-2" }),
        ]),
      );
    });
  });

  // Cleanup all IndexedDB data after all tests
  afterAll(async () => {
    await LibraryDB.delete();
  });
});
