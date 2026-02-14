import yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hydrateComponentReference } from "@/services/componentService";
import type { ComponentReference } from "@/utils/componentSpec";

import { InvalidComponentReferenceError } from "./types";
import { fetchWithCache } from "./utils";
import { YamlFileLibrary } from "./yamlFileLibrary";

// Mock fetchWithCache - required because it uses browser Cache API
vi.mock("./utils", () => ({
  fetchWithCache: vi.fn(),
}));

// Mock hydrateComponentReference - required because it accesses localforage
vi.mock("@/services/componentService", () => ({
  hydrateComponentReference: vi.fn(),
}));

const mockFetchWithCache = vi.mocked(fetchWithCache);
const mockHydrateComponentReference = vi.mocked(hydrateComponentReference);

function createComponentReference(
  overrides?: Partial<ComponentReference>,
): ComponentReference {
  return {
    name: "test-component",
    digest: "sha256:abc123",
    url: "https://example.com/component.yaml",
    ...overrides,
  };
}

function createValidLibraryYaml(components: ComponentReference[] = []) {
  const folder = {
    name: "Test Folder",
    components: components.map((c) => ({
      name: c.name,
      digest: c.digest,
      url: c.url,
    })),
  };

  return yaml.dump({ folders: [folder] });
}

function mockFetchResponse(
  yamlContent: string,
  options: { ok?: boolean; status?: number } = {},
) {
  const { ok = true, status = 200 } = options;

  mockFetchWithCache.mockResolvedValue({
    ok,
    status,
    arrayBuffer: async () => new TextEncoder().encode(yamlContent).buffer,
  } as Response);
}

describe("YamlFileLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("hasComponent", () => {
    it("should return true when component exists by digest", async () => {
      // Arrange
      const component = createComponentReference({ digest: "sha256:exists" });
      mockFetchResponse(createValidLibraryYaml([component]));
      mockHydrateComponentReference.mockResolvedValue({
        name: component.name!,
        digest: component.digest!,
        url: component.url!,
        spec: {
          name: component.name!,
          implementation: { graph: { tasks: {} } },
        },
        text: "name: test",
      });
      const library = new YamlFileLibrary("Test", "/test.yaml");

      // Act
      const result = await library.hasComponent(component);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when component does not exist", async () => {
      // Arrange
      const existingComponent = createComponentReference({
        digest: "sha256:exists",
      });
      const nonExistentComponent = createComponentReference({
        digest: "sha256:not-found",
      });
      mockFetchResponse(createValidLibraryYaml([existingComponent]));
      mockHydrateComponentReference.mockResolvedValue({
        name: existingComponent.name!,
        digest: existingComponent.digest!,
        url: existingComponent.url!,
        spec: {
          name: existingComponent.name!,
          implementation: { graph: { tasks: {} } },
        },
        text: "name: test",
      });
      const library = new YamlFileLibrary("Test", "/test.yaml");

      // Act
      const result = await library.hasComponent(nonExistentComponent);

      // Assert
      expect(result).toBe(false);
    });

    it("should throw InvalidComponentReferenceError for component without digest", async () => {
      // Arrange
      mockFetchResponse(createValidLibraryYaml());
      const library = new YamlFileLibrary("Test", "/test.yaml");
      const componentWithoutDigest = createComponentReference({
        digest: undefined,
      });

      // Act & Assert
      await expect(
        library.hasComponent(componentWithoutDigest),
      ).rejects.toThrow(InvalidComponentReferenceError);
    });
  });

  describe("getComponents", () => {
    it("should return folder structure without filter", async () => {
      // Arrange
      const component = createComponentReference();
      mockFetchResponse(createValidLibraryYaml([component]));
      mockHydrateComponentReference.mockResolvedValue({
        name: component.name!,
        digest: component.digest!,
        url: component.url!,
        spec: {
          name: component.name!,
          implementation: { graph: { tasks: {} } },
        },
        text: "name: test",
      });
      const library = new YamlFileLibrary("Test Library", "/test.yaml");

      // Act
      const result = await library.getComponents();

      // Assert
      expect(result.name).toBe("Test Library");
      expect(result.folders).toHaveLength(1);
      expect(result.folders![0].name).toBe("Test Folder");
      expect(result.folders![0].components).toHaveLength(1);
    });

    it("should return flat component list when filter is provided", async () => {
      // Arrange
      const component = createComponentReference();
      mockFetchResponse(createValidLibraryYaml([component]));
      mockHydrateComponentReference.mockResolvedValue({
        name: component.name!,
        digest: component.digest!,
        url: component.url!,
        spec: {
          name: component.name!,
          implementation: { graph: { tasks: {} } },
        },
        text: "name: test",
      });
      const library = new YamlFileLibrary("Test Library", "/test.yaml");

      // Act
      const result = await library.getComponents({
        searchTerm: "test",
        filters: ["name"],
      });

      // Assert
      expect(result.name).toBe("Test Library");
      expect(result.components).toHaveLength(1);
      expect(result.components![0].digest).toBe(component.digest);
    });
  });

  describe("library loading", () => {
    it("should throw error when fetch fails", async () => {
      // Arrange
      mockFetchResponse("", { ok: false, status: 404 });
      const library = new YamlFileLibrary("Test", "/not-found.yaml");

      // Act & Assert
      await expect(library.getComponents()).rejects.toThrow(
        "Failed to fetch /not-found.yaml: 404",
      );
    });

    it("should throw error for invalid YAML structure", async () => {
      // Arrange
      mockFetchResponse("name: missing-folders-property");
      const library = new YamlFileLibrary("Test", "/invalid.yaml");

      // Act & Assert
      await expect(library.getComponents()).rejects.toThrow(
        "Invalid component library: /invalid.yaml",
      );
    });
  });
});
