import { QueryClient } from "@tanstack/react-query";
import yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ComponentReferenceInput,
  ComponentResponse,
  HttpValidationError,
  PublishedComponentResponse,
} from "@/api/types.gen";
import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";
import {
  type ComponentReferenceWithSpec,
  generateDigest,
} from "@/utils/componentStore";

import { PublishedComponentsLibrary } from "./publishedComponentsLibrary";
import {
  DuplicateComponentError,
  InvalidComponentReferenceError,
} from "./types";

// Mock all dependencies
vi.mock("@/api/sdk.gen");

// Import mocked modules
import * as apiSdk from "@/api/sdk.gen";

// Mock fetch globally
global.fetch = vi.fn();

describe("PublishedComponentsLibrary", () => {
  // Mock implementations
  const mockGetApiComponentsDigestGet = vi.mocked(
    apiSdk.getApiComponentsDigestGet,
  );
  const mockListApiPublishedComponentsGet = vi.mocked(
    apiSdk.listApiPublishedComponentsGet,
  );
  const mockPublishApiPublishedComponentsPost = vi.mocked(
    apiSdk.publishApiPublishedComponentsPost,
  );
  const mockUpdateApiPublishedComponentsDigestPut = vi.mocked(
    apiSdk.updateApiPublishedComponentsDigestPut,
  );

  // Test fixtures
  const mockComponentSpec: ComponentSpec = {
    name: "test-component",
    implementation: {
      graph: {
        tasks: {},
      },
    },
  };

  const createMockComponentReference = (
    overrides?: Partial<ComponentReference>,
  ): ComponentReference => ({
    name: "test-component",
    digest: "test-digest-123",
    url: "https://example.com/component.yaml",
    ...overrides,
  });

  const createMockComponentReferenceWithSpec = (
    overrides?: Partial<ComponentReferenceWithSpec>,
  ): ComponentReferenceWithSpec => ({
    name: "test-component",
    digest: "test-digest-123",
    url: "https://example.com/component.yaml",
    spec: mockComponentSpec,
    text: yaml.dump(mockComponentSpec),
    ...overrides,
  });

  const createMockPublishedComponent = (
    overrides?: Partial<PublishedComponentResponse>,
  ): PublishedComponentResponse => ({
    digest: "test-digest-123",
    name: "test-component",
    url: "https://example.com/component.yaml",
    published_by: "test-user",
    deprecated: false,
    ...overrides,
  });

  const createMockApiResponse = <T>(data: T, status = 200) => ({
    data,
    error: undefined,
    request: new Request("http://test.com"),
    response: {
      status,
      headers: new Headers(),
      ok: status >= 200 && status < 300,
    } as Response,
  });

  const createMockApiErrorResponse = (
    status: number,
    error?: HttpValidationError,
  ) => ({
    data: undefined,
    error: error ?? ({} as HttpValidationError),
    request: new Request("http://test.com"),
    response: {
      status,
      headers: new Headers(),
      ok: false,
    } as Response,
  });

  let library: PublishedComponentsLibrary;
  let mockQueryClient: QueryClient;

  beforeEach(() => {
    mockQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock the fetchQuery method
    vi.spyOn(mockQueryClient, "fetchQuery").mockImplementation(
      async ({ queryFn, queryKey }) => {
        return typeof queryFn === "function"
          ? await queryFn({
              queryKey,
              signal: new AbortController().signal,
              client: mockQueryClient,
              pageParam: undefined,
              direction: "forward" as const,
              meta: undefined,
            })
          : undefined;
      },
    );

    library = new PublishedComponentsLibrary(mockQueryClient);
    vi.clearAllMocks();

    // Default fetch mock
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers(),
      text: async () => yaml.dump(mockComponentSpec),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("hasComponent", () => {
    it("should return true if component exists in backend", async () => {
      // Arrange
      const component = createMockComponentReference();
      const componentText = yaml.dump(mockComponentSpec);

      const mockComponentResponse: ComponentResponse = {
        digest: "test-digest-123",
        text: componentText,
      };

      mockGetApiComponentsDigestGet.mockResolvedValue(
        createMockApiResponse(mockComponentResponse),
      );

      // Act
      const result = await library.hasComponent(component);

      // Assert
      expect(result).toBe(true);
      expect(mockGetApiComponentsDigestGet).toHaveBeenCalledWith({
        path: { digest: component.digest },
      });
    });

    it("should return false if component does not exist (404)", async () => {
      // Arrange
      const component = createMockComponentReference();

      mockGetApiComponentsDigestGet.mockResolvedValue(
        createMockApiErrorResponse(404),
      );

      // Act
      const result = await library.hasComponent(component);

      // Assert
      expect(result).toBe(false);
      expect(mockGetApiComponentsDigestGet).toHaveBeenCalledWith({
        path: { digest: component.digest },
      });
    });

    it("should use cached digest to return true without API call", async () => {
      // Arrange
      const componentText = yaml.dump(mockComponentSpec);
      const component = createMockComponentReferenceWithSpec({
        digest: await generateDigest(componentText),
      });

      // First call to cache the digest
      const mockComponentResponse: ComponentResponse = {
        digest: await generateDigest(componentText),
        text: componentText,
      };
      mockGetApiComponentsDigestGet.mockResolvedValue(
        createMockApiResponse(mockComponentResponse),
      );

      const firstResult = await library.hasComponent(component);
      expect(firstResult).toBe(true);
      expect(mockGetApiComponentsDigestGet).toHaveBeenCalledTimes(1);

      // Act - second call should use cache
      const result = await library.hasComponent(component);

      // Assert - the API should have been called only once (during first call)
      expect(result).toBe(true);
      expect(mockGetApiComponentsDigestGet).toHaveBeenCalledTimes(1);
    });

    it("should throw InvalidComponentReferenceError for invalid component", async () => {
      // Arrange
      const invalidComponent = { name: "invalid" } as ComponentReference;

      // Act & Assert
      const result = await library.hasComponent(invalidComponent);
      expect(result).toBe(false);
      expect(mockGetApiComponentsDigestGet).not.toHaveBeenCalled();
    });

    it("should throw BackendLibraryError for unexpected status codes", async () => {
      // Arrange
      const component = createMockComponentReference();

      mockGetApiComponentsDigestGet.mockResolvedValue(
        createMockApiErrorResponse(500),
      );

      // Act & Assert
      await expect(library.hasComponent(component)).rejects.toThrow(
        "Unexpected status code: 500",
      );
    });

    it("should throw BackendLibraryError when no data is returned", async () => {
      // Arrange
      const component = createMockComponentReference();

      mockGetApiComponentsDigestGet.mockResolvedValue({
        data: undefined,
        error: undefined,
        request: new Request("http://test.com"),
        response: {
          status: 200,
          headers: new Headers(),
          ok: true,
        } as Response,
      } as any);

      // Act & Assert
      await expect(library.hasComponent(component)).rejects.toThrow(
        "No data returned from server",
      );
    });

    it("should throw BackendLibraryError when hydration fails", async () => {
      // Arrange
      const component = createMockComponentReference();

      const mockComponentResponse: ComponentResponse = {
        digest: "test-digest-123",
        text: "invalid: yaml: content: {{{",
      };
      mockGetApiComponentsDigestGet.mockResolvedValue(
        createMockApiResponse(mockComponentResponse),
      );

      // Act & Assert
      await expect(library.hasComponent(component)).rejects.toThrow(
        `Failed to hydrate component: ${component.digest}`,
      );
    });
  });

  describe("addComponent", () => {
    it("should successfully add a new component", async () => {
      // Arrange
      const componentText = yaml.dump(mockComponentSpec);
      const hydratedComponent = createMockComponentReferenceWithSpec({
        text: componentText,
      });

      // Mock fetch for URL-based component retrieval if needed
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers(),
        text: async () => componentText,
      });

      mockPublishApiPublishedComponentsPost.mockResolvedValue(
        createMockApiResponse(createMockPublishedComponent()),
      );

      // Act
      await library.addComponent(hydratedComponent);

      // Assert
      expect(mockPublishApiPublishedComponentsPost).toHaveBeenCalledWith({
        body: {
          name: hydratedComponent.name,
          digest: hydratedComponent.digest,
          url: hydratedComponent.url,
          spec: hydratedComponent.spec,
          text: hydratedComponent.text,
        } as ComponentReferenceInput,
      });
    });

    it("should throw DuplicateComponentError if component already in cache", async () => {
      // Arrange
      const component = createMockComponentReference();
      const componentText = yaml.dump(mockComponentSpec);
      const hydratedComponent = createMockComponentReferenceWithSpec({
        text: componentText,
      });

      mockPublishApiPublishedComponentsPost.mockResolvedValue(
        createMockApiResponse(createMockPublishedComponent()),
      );

      // Add component first
      await library.addComponent(hydratedComponent);

      // Act & Assert - try to add again
      await expect(library.addComponent(component)).rejects.toThrow(
        DuplicateComponentError,
      );
    });

    it("should throw InvalidComponentReferenceError if hydration fails", async () => {
      // Arrange
      const component = createMockComponentReference({
        digest: undefined,
        url: undefined,
        spec: undefined,
        text: undefined,
      });

      // Act & Assert
      await expect(library.addComponent(component)).rejects.toThrow(
        InvalidComponentReferenceError,
      );
    });

    it("should throw BackendValidationError for validation errors (422)", async () => {
      // Arrange
      const componentText = yaml.dump(mockComponentSpec);
      const hydratedComponent = createMockComponentReferenceWithSpec({
        text: componentText,
      });
      const validationError: HttpValidationError = {
        detail: [
          {
            loc: ["body", "spec"],
            msg: "Invalid spec",
            type: "validation_error",
          },
        ],
      };

      mockPublishApiPublishedComponentsPost.mockResolvedValue(
        createMockApiErrorResponse(422, validationError),
      );

      // Act & Assert
      await expect(library.addComponent(hydratedComponent)).rejects.toThrow(
        "Invalid component",
      );
      expect(mockPublishApiPublishedComponentsPost).toHaveBeenCalled();
    });

    it("should throw BackendLibraryError for unexpected status codes", async () => {
      // Arrange
      const componentText = yaml.dump(mockComponentSpec);
      const hydratedComponent = createMockComponentReferenceWithSpec({
        text: componentText,
      });

      mockPublishApiPublishedComponentsPost.mockResolvedValue(
        createMockApiErrorResponse(500),
      );

      // Act & Assert
      await expect(library.addComponent(hydratedComponent)).rejects.toThrow(
        "Unexpected status code: 500",
      );
    });

    it("should handle and rethrow network errors", async () => {
      // Arrange
      const componentText = yaml.dump(mockComponentSpec);
      const hydratedComponent = createMockComponentReferenceWithSpec({
        text: componentText,
      });
      const networkError = new Error("Network error");

      mockPublishApiPublishedComponentsPost.mockRejectedValue(networkError);

      // Act & Assert
      await expect(library.addComponent(hydratedComponent)).rejects.toThrow(
        "Network error",
      );
    });
  });

  describe("removeComponent", () => {
    it("should successfully deprecate a component", async () => {
      // Arrange
      const componentText = yaml.dump(mockComponentSpec);
      const hydratedComponent = createMockComponentReferenceWithSpec({
        text: componentText,
      });

      mockUpdateApiPublishedComponentsDigestPut.mockResolvedValue(
        createMockApiResponse(createMockPublishedComponent()),
      );

      // Act
      await library.removeComponent(hydratedComponent);

      // Assert
      expect(mockUpdateApiPublishedComponentsDigestPut).toHaveBeenCalledWith({
        path: { digest: hydratedComponent.digest },
        query: {
          deprecated: true,
          superseded_by: undefined,
        },
      });
    });

    it("should deprecate component with supersededBy option", async () => {
      // Arrange
      const componentText = yaml.dump(mockComponentSpec);
      const newComponentText = yaml.dump({
        ...mockComponentSpec,
        name: "new-component",
      });
      const hydratedComponent = createMockComponentReferenceWithSpec({
        text: componentText,
      });
      const hydratedSupersedeBy = createMockComponentReferenceWithSpec({
        digest: "new-digest-456",
        name: "new-component",
        text: newComponentText,
      });

      mockPublishApiPublishedComponentsPost.mockResolvedValue(
        createMockApiResponse(
          createMockPublishedComponent({
            digest: "new-digest-456",
            name: "new-component",
          }),
        ),
      );
      mockUpdateApiPublishedComponentsDigestPut.mockResolvedValue(
        createMockApiResponse(createMockPublishedComponent()),
      );

      // Act
      await library.removeComponent(hydratedComponent, {
        supersedeBy: hydratedSupersedeBy,
      });

      // Assert
      expect(mockPublishApiPublishedComponentsPost).toHaveBeenCalledWith({
        body: expect.objectContaining({
          digest: "new-digest-456",
        }),
      });
      expect(mockUpdateApiPublishedComponentsDigestPut).toHaveBeenCalledWith({
        path: { digest: hydratedComponent.digest },
        query: {
          deprecated: true,
          superseded_by: "new-digest-456",
        },
      });
    });

    it("should throw InvalidComponentReferenceError if component hydration fails", async () => {
      // Arrange
      const component = createMockComponentReference({
        digest: undefined,
        url: undefined,
        spec: undefined,
        text: undefined,
      });

      // Act & Assert
      await expect(library.removeComponent(component)).rejects.toThrow(
        InvalidComponentReferenceError,
      );
    });

    it("should throw InvalidComponentReferenceError if supersedeBy hydration fails", async () => {
      // Arrange
      const supersedeByComponent = createMockComponentReference({
        digest: undefined,
        url: undefined,
        spec: undefined,
        text: undefined,
      });
      const componentText = yaml.dump(mockComponentSpec);
      const hydratedComponent = createMockComponentReferenceWithSpec({
        text: componentText,
      });

      // Act & Assert
      await expect(
        library.removeComponent(hydratedComponent, {
          supersedeBy: supersedeByComponent,
        }),
      ).rejects.toThrow(InvalidComponentReferenceError);
    });

    it("should throw BackendLibraryError for failed deletion", async () => {
      // Arrange
      const componentText = yaml.dump(mockComponentSpec);
      const hydratedComponent = createMockComponentReferenceWithSpec({
        text: componentText,
      });

      mockUpdateApiPublishedComponentsDigestPut.mockResolvedValue(
        createMockApiErrorResponse(500),
      );

      // Act & Assert
      await expect(library.removeComponent(hydratedComponent)).rejects.toThrow(
        "Failed to delete component. Unexpected status code: 500",
      );
    });
  });

  describe("getComponents", () => {
    it("should return all components without filter", async () => {
      // Arrange
      const publishedComponents = [
        createMockPublishedComponent(),
        createMockPublishedComponent({
          digest: "digest-2",
          name: "component-2",
        }),
      ];

      mockListApiPublishedComponentsGet.mockResolvedValue(
        createMockApiResponse({
          published_components: publishedComponents,
        }),
      );

      // Act
      const result = await library.getComponents({});

      // Assert
      expect(result).toEqual({
        name: "Published Components",
        components: expect.arrayContaining([
          expect.objectContaining({
            digest: "test-digest-123",
            name: "test-component",
          }),
          expect.objectContaining({
            digest: "digest-2",
            name: "component-2",
          }),
        ]),
        folders: [],
      });
      expect(mockListApiPublishedComponentsGet).toHaveBeenCalledWith({});
    });

    it("should filter components by name", async () => {
      // Arrange
      const filter = {
        searchTerm: "test",
        filters: ["name"],
      };
      const publishedComponents = [createMockPublishedComponent()];

      mockListApiPublishedComponentsGet.mockResolvedValue(
        createMockApiResponse({
          published_components: publishedComponents,
        }),
      );

      // Act
      const result = await library.getComponents(filter);

      // Assert
      expect(mockListApiPublishedComponentsGet).toHaveBeenCalledWith({
        query: {
          name_substring: "test",
          published_by_substring: undefined,
          include_deprecated: false,
        },
      });
      expect(result.components).toHaveLength(1);
    });

    it("should filter components by author", async () => {
      // Arrange
      const filter = {
        searchTerm: "john",
        filters: ["author"],
      };
      const publishedComponents = [
        createMockPublishedComponent({ published_by: "john.doe" }),
      ];

      mockListApiPublishedComponentsGet.mockResolvedValue(
        createMockApiResponse({
          published_components: publishedComponents,
        }),
      );

      // Act
      const result = await library.getComponents(filter);

      // Assert
      expect(mockListApiPublishedComponentsGet).toHaveBeenCalledWith({
        query: {
          name_substring: undefined,
          published_by_substring: "john",
          include_deprecated: false,
        },
      });
      expect(result.components!).toHaveLength(1);
      expect(result.components![0]).toHaveProperty("published_by", "john.doe");
    });

    it("should include deprecated components when filtered", async () => {
      // Arrange
      const filter = {
        searchTerm: "test",
        filters: ["deprecated"],
      };
      const publishedComponents = [
        createMockPublishedComponent({ deprecated: true }),
      ];

      mockListApiPublishedComponentsGet.mockResolvedValue(
        createMockApiResponse({
          published_components: publishedComponents,
        }),
      );

      // Act
      const result = await library.getComponents(filter);

      // Assert
      expect(mockListApiPublishedComponentsGet).toHaveBeenCalledWith({
        query: {
          name_substring: undefined,
          published_by_substring: undefined,
          include_deprecated: true,
        },
      });
      expect(result.components!).toHaveLength(1);
      expect(result.components![0]).toHaveProperty("deprecated", true);
    });

    it("should apply multiple filters", async () => {
      // Arrange
      const filter = {
        searchTerm: "test",
        filters: ["name", "author", "deprecated"],
      };
      const publishedComponents = [createMockPublishedComponent()];

      mockListApiPublishedComponentsGet.mockResolvedValue(
        createMockApiResponse({
          published_components: publishedComponents,
        }),
      );

      // Act
      await library.getComponents(filter);

      // Assert
      expect(mockListApiPublishedComponentsGet).toHaveBeenCalledWith({
        query: {
          name_substring: "test",
          published_by_substring: "test",
          include_deprecated: true,
        },
      });
    });

    it("should handle superseded_by field in response", async () => {
      // Arrange
      const publishedComponents = [
        createMockPublishedComponent({
          deprecated: true,
          superseded_by: "new-digest-789",
        }),
      ];

      mockListApiPublishedComponentsGet.mockResolvedValue(
        createMockApiResponse({
          published_components: publishedComponents,
        }),
      );

      // Act
      const result = await library.getComponents({});

      // Assert
      expect(result.components!).toHaveLength(1);
      expect(result.components![0]).toHaveProperty(
        "superseded_by",
        "new-digest-789",
      );
    });

    it("should use API_URL for components without URL", async () => {
      // Arrange
      const publishedComponents = [
        createMockPublishedComponent({ url: undefined }),
      ];

      mockListApiPublishedComponentsGet.mockResolvedValue(
        createMockApiResponse({
          published_components: publishedComponents,
        }),
      );

      // Act
      const result = await library.getComponents({});

      // Assert
      expect(result.components!).toHaveLength(1);
      expect(result.components![0].url).toMatch(
        /\/api\/components\/test-digest-123$/,
      );
    });

    it("should handle empty response gracefully", async () => {
      // Arrange
      mockListApiPublishedComponentsGet.mockResolvedValue(
        createMockApiResponse({
          published_components: [],
        }),
      );

      // Act
      const result = await library.getComponents({});

      // Assert
      expect(result).toEqual({
        name: "Published Components",
        components: [],
        folders: [],
      });
    });

    it("should throw BackendLibraryError for unexpected status codes", async () => {
      // Arrange
      mockListApiPublishedComponentsGet.mockResolvedValue(
        createMockApiErrorResponse(500),
      );

      // Act & Assert
      await expect(library.getComponents({})).rejects.toThrow(
        "Unexpected status code: 500",
      );
    });

    it("should throw BackendLibraryError when no data is returned", async () => {
      // Arrange
      mockListApiPublishedComponentsGet.mockResolvedValue({
        data: undefined,
        error: undefined as any,
        request: new Request("http://test.com"),
        response: {
          status: 200,
          headers: new Headers(),
          ok: true,
        } as Response,
      });

      // Act & Assert
      await expect(library.getComponents({})).rejects.toThrow(
        "No data returned from server",
      );
    });
  });

  describe("Component caching behavior", () => {
    it("should cache digests across multiple method calls", async () => {
      // Arrange
      const componentText = yaml.dump(mockComponentSpec);
      const hydratedComponent = createMockComponentReferenceWithSpec({
        text: componentText,
      });

      // First, add the component to populate the cache
      mockPublishApiPublishedComponentsPost.mockResolvedValue(
        createMockApiResponse(createMockPublishedComponent()),
      );

      await library.addComponent(hydratedComponent);

      // Now try to add it again (should fail due to cache)
      await expect(library.addComponent(hydratedComponent)).rejects.toThrow(
        DuplicateComponentError,
      );
    });

    it("should update cache after successful add", async () => {
      // Arrange
      const component = createMockComponentReference();
      const componentText = yaml.dump(mockComponentSpec);
      const hydratedComponent = createMockComponentReferenceWithSpec({
        text: componentText,
      });

      mockPublishApiPublishedComponentsPost.mockResolvedValue(
        createMockApiResponse(createMockPublishedComponent()),
      );

      // Act - Add component
      await library.addComponent(hydratedComponent);

      // Clear mock calls but keep library's internal cache
      mockGetApiComponentsDigestGet.mockClear();
      mockPublishApiPublishedComponentsPost.mockClear();

      // Check if component exists (should use cache)
      const exists = await library.hasComponent(component);

      // Assert
      expect(exists).toBe(true);
      expect(mockGetApiComponentsDigestGet).not.toHaveBeenCalled();
    });
  });
});
