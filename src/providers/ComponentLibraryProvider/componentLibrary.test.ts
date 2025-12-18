import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as componentService from "@/services/componentService";
import type {
  ComponentFolder,
  ComponentLibrary,
} from "@/types/componentLibrary";
import type {
  ComponentReference,
  ComponentSpec,
  GraphSpec,
  TaskSpec,
} from "@/utils/componentSpec";
import * as componentStore from "@/utils/componentStore";
import * as localforage from "@/utils/localforage";
import * as yamlUtils from "@/utils/yaml";

import {
  fetchUsedComponents,
  filterToUniqueByDigest,
  flattenFolders,
  populateComponentRefs,
} from "./componentLibrary";

// Mock external dependencies
vi.mock("@/services/componentService");
vi.mock("@/utils/componentStore");
vi.mock("@/utils/localforage");

const mockComponentService = vi.mocked(componentService);
const mockComponentStore = vi.mocked(componentStore);
const mockLocalforage = vi.mocked(localforage);

describe("componentLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(yamlUtils, "componentSpecToYaml").mockReturnValue("spec-as-yaml");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchUsedComponents", () => {
    it("should return components used in pipeline tasks", () => {
      // Arrange
      const mockGraphSpec: GraphSpec = {
        tasks: {
          task1: {
            componentRef: {
              name: "component-1",
              digest: "digest1",
              url: "https://example.com/component1.yaml",
            },
          } as TaskSpec,
          task2: {
            componentRef: {
              name: "component-2",
              digest: "digest2",
              url: "https://example.com/component2.yaml",
            },
          } as TaskSpec,
        },
      };

      // Act
      const result = fetchUsedComponents(mockGraphSpec);

      // Assert
      expect(result).toEqual({
        name: "Used in Pipeline",
        components: [
          {
            name: "component-1",
            digest: "digest1",
            url: "https://example.com/component1.yaml",
          },
          {
            name: "component-2",
            digest: "digest2",
            url: "https://example.com/component2.yaml",
          },
        ],
        folders: [],
        isUserFolder: false,
      });
    });

    it("should deduplicate components with same digest", () => {
      // Arrange
      const mockGraphSpec: GraphSpec = {
        tasks: {
          task1: {
            componentRef: {
              name: "component-1",
              digest: "same-digest",
              url: "https://example.com/component1.yaml",
            },
          } as TaskSpec,
          task2: {
            componentRef: {
              name: "component-1-duplicate",
              digest: "same-digest",
              url: "https://example.com/component1.yaml",
            },
          } as TaskSpec,
        },
      };

      // Act
      const result = fetchUsedComponents(mockGraphSpec);

      // Assert
      expect(result.components).toHaveLength(1);
      expect(result.components?.[0]?.digest).toBe("same-digest");
    });

    it("should return empty folder when graphSpec is invalid", () => {
      // Act
      const result1 = fetchUsedComponents(null as any);
      const result2 = fetchUsedComponents({} as GraphSpec);
      const result3 = fetchUsedComponents({ tasks: null } as any);

      // Assert
      const expectedResult = {
        name: "Used in Pipeline",
        components: [],
        folders: [],
        isUserFolder: false,
      };
      expect(result1).toEqual(expectedResult);
      expect(result2).toEqual(expectedResult);
      expect(result3).toEqual(expectedResult);
    });

    // todo: test with components without digest
    // todo: test with deeply nested task structures
  });

  describe("populateComponentRefs", () => {
    beforeEach(() => {
      mockComponentService.parseComponentData.mockImplementation(
        (text) =>
          ({
            name: `parsed-${text}`,
            implementation: { graph: { tasks: {} } },
          }) as ComponentSpec,
      );
      mockComponentStore.generateDigest.mockImplementation(
        async (text) => `digest-${text}`,
      );
    });

    it("should generate text and digest from spec when only spec exists", async () => {
      // Arrange
      const componentRef: ComponentReference = {
        name: "test-component",
        digest: "existing-digest",
        spec: {
          name: "existing-spec",
          implementation: { graph: { tasks: {} } },
        },
      };
      const folder: ComponentFolder = {
        name: "Test Folder",
        components: [componentRef],
        folders: [],
      };

      // Mock componentSpecToYaml to return predictable text
      vi.spyOn(yamlUtils, "componentSpecToYaml").mockReturnValue(
        "spec-as-yaml",
      );

      // Act
      const result = await populateComponentRefs(folder);

      // Assert
      expect(result.components?.[0]).toEqual({
        name: "test-component",
        digest: "digest-spec-as-yaml",
        spec: {
          name: "existing-spec",
          implementation: { graph: { tasks: {} } },
        },
        text: "spec-as-yaml",
      });
      expect(yamlUtils.componentSpecToYaml).toHaveBeenCalledWith(
        componentRef.spec,
      );
      expect(mockComponentStore.generateDigest).toHaveBeenCalledWith(
        "spec-as-yaml",
      );
      expect(mockComponentService.parseComponentData).not.toHaveBeenCalled();
    });

    it("should populate spec from text when spec is missing", async () => {
      // Arrange
      const componentRef: ComponentReference = {
        name: "test-component",
        digest: "existing-digest",
        text: "component-yaml-text",
      };
      const folder: ComponentFolder = {
        name: "Test Folder",
        components: [componentRef],
        folders: [],
      };

      // Act
      const result = await populateComponentRefs(folder);

      // Assert
      expect(result.components?.[0]).toEqual({
        name: "test-component",
        digest: "digest-component-yaml-text",
        text: "component-yaml-text",
        spec: {
          name: "parsed-component-yaml-text",
          implementation: { graph: { tasks: {} } },
        },
      });
      expect(mockComponentService.parseComponentData).toHaveBeenCalledWith(
        "component-yaml-text",
      );
      expect(mockComponentStore.generateDigest).toHaveBeenCalledWith(
        "component-yaml-text",
      );
    });

    it("should fetch from URL when text is missing", async () => {
      // Arrange
      const componentRef: ComponentReference = {
        name: "test-component",
        url: "https://example.com/component.yaml",
      };
      const folder: ComponentFolder = {
        name: "Test Folder",
        components: [componentRef],
        folders: [],
      };

      mockLocalforage.getComponentByUrl.mockResolvedValue({
        id: "test-id",
        url: "https://example.com/component.yaml",
        data: "fetched-yaml-text",
        favorited: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Act
      const result = await populateComponentRefs(folder);

      // Assert
      expect(result.components?.[0]).toEqual({
        name: "test-component",
        url: "https://example.com/component.yaml",
        spec: {
          name: "parsed-fetched-yaml-text",
          implementation: { graph: { tasks: {} } },
        },
        digest: "digest-fetched-yaml-text",
        text: "fetched-yaml-text",
        favorited: true,
      });
      expect(mockLocalforage.getComponentByUrl).toHaveBeenCalledWith(
        "https://example.com/component.yaml",
      );
    });

    it("should recursively populate refs in nested folders", async () => {
      // Arrange
      const library: ComponentLibrary = {
        folders: [
          {
            name: "Parent Folder",
            components: [
              {
                name: "parent-component",
                text: "parent-yaml",
              },
            ],
            folders: [
              {
                name: "Child Folder",
                components: [
                  {
                    name: "child-component",
                    text: "child-yaml",
                  },
                ],
                folders: [],
              },
            ],
          },
        ],
      };

      // Act
      const result = await populateComponentRefs(library);

      // Assert
      expect(result.folders?.[0]?.components?.[0]?.spec?.name).toBe(
        "parsed-parent-yaml",
      );
      expect(
        result.folders?.[0]?.folders?.[0]?.components?.[0]?.spec?.name,
      ).toBe("parsed-child-yaml");
    });

    // todo: test error handling when parsing fails
    // todo: test when URL fetch fails
  });

  describe("flattenFolders", () => {
    it("should flatten nested folder structure into single component array", () => {
      // Arrange
      const library: ComponentLibrary = {
        folders: [
          {
            name: "Folder 1",
            components: [
              { name: "component-1", digest: "digest1" },
              { name: "component-2", digest: "digest2" },
            ],
            folders: [
              {
                name: "Subfolder 1.1",
                components: [{ name: "component-3", digest: "digest3" }],
                folders: [
                  {
                    name: "Deep Subfolder",
                    components: [{ name: "component-4", digest: "digest4" }],
                    folders: [],
                  },
                ],
              },
            ],
          },
          {
            name: "Folder 2",
            components: [{ name: "component-5", digest: "digest5" }],
            folders: [],
          },
        ],
      };

      // Act
      const result = flattenFolders(library);

      // Assert
      expect(result).toHaveLength(5);
      expect(result.map((c) => c.name)).toEqual([
        "component-1",
        "component-2",
        "component-3",
        "component-4",
        "component-5",
      ]);
    });

    it("should handle empty folders", () => {
      // Arrange
      const folder: ComponentFolder = {
        name: "Empty Folder",
        components: [],
        folders: [],
      };

      // Act
      const result = flattenFolders(folder);

      // Assert
      expect(result).toEqual([]);
    });

    it("should handle folder with only components", () => {
      // Arrange
      const folder: ComponentFolder = {
        name: "Simple Folder",
        components: [
          { name: "component-1", digest: "digest1" },
          { name: "component-2", digest: "digest2" },
        ],
        folders: [],
      };

      // Act
      const result = flattenFolders(folder);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("component-1");
      expect(result[1].name).toBe("component-2");
    });

    // todo: test with malformed folder structures
  });

  describe("filterToUniqueByDigest", () => {
    it("should filter components to unique digests only", () => {
      // Arrange
      const components: ComponentReference[] = [
        { name: "component-1", digest: "digest1" },
        { name: "component-2", digest: "digest2" },
        { name: "component-1-duplicate", digest: "digest1" },
        { name: "component-3", digest: "digest3" },
        { name: "component-2-duplicate", digest: "digest2" },
      ];

      // Act
      const result = filterToUniqueByDigest(components);

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map((c) => c.digest)).toEqual([
        "digest1",
        "digest2",
        "digest3",
      ]);
      expect(result.map((c) => c.name)).toEqual([
        "component-1",
        "component-2",
        "component-3",
      ]);
    });

    it("should preserve components without digest", () => {
      // Arrange
      const components: ComponentReference[] = [
        { name: "component-1", digest: "digest1" },
        { name: "component-no-digest-1" },
        { name: "component-no-digest-2" },
        { name: "component-2", digest: "digest1" }, // duplicate digest
      ];

      // Act
      const result = filterToUniqueByDigest(components);

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map((c) => c.name)).toEqual([
        "component-1",
        "component-no-digest-1",
        "component-no-digest-2",
      ]);
    });

    it("should handle empty array", () => {
      // Act
      const result = filterToUniqueByDigest([]);

      // Assert
      expect(result).toEqual([]);
    });

    // todo: test with null/undefined digest values
  });
});
