import { waitFor } from "@testing-library/dom";
import yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";
import * as localforage from "@/utils/localforage";

import { hydrateComponentReference } from "./componentService";

vi.mock("@/utils/localforage", () => ({
  getComponentById: vi.fn(),
  getComponentByUrl: vi.fn(),
  saveComponent: vi.fn(),
}));

describe("hydrateComponentReference()", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("HydratedComponentReference", () => {
    describe("when reference contains digest, name, spec, and text", () => {
      it("should return the already hydrated component without modifications", async () => {
        // Arrange
        const testDigest = "hydrated123digest456";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("HydratedComponent", "hydrated:v1");

        const hydratedRef = {
          digest: testDigest,
          name: "HydratedComponent",
          spec: componentSpec,
          text: componentText,
        };

        // Act
        const result = await hydrateComponentReference(hydratedRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.digest).toBe(testDigest);
        expect(result?.name).toBe("HydratedComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
        expect(localforage.getComponentByUrl).not.toHaveBeenCalled();
        expect(localforage.saveComponent).toHaveBeenCalled();
      });
    });
  });

  describe("DiscoverableComponentReference", () => {
    describe("when digest is known (component exists in storage)", () => {
      it("should hydrate component from storage when stored component contains both text and spec", async () => {
        // Arrange
        const testDigest = "abc123def456";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("TestComponent", "test:latest");

        mockGetComponentById({
          digest: testDigest,
          url: "https://example.com/component.yaml",
          spec: componentSpec,
        });

        const discoverableRef = { digest: testDigest };

        // Act
        const result = await hydrateComponentReference(discoverableRef);

        // Assert
        expect(localforage.getComponentById).toHaveBeenCalledWith(
          `component-${testDigest}`,
        );
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.name).toBe("TestComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
        expect(localforage.saveComponent).toHaveBeenCalled();
      });

      it("should hydrate component from storage when stored component contains only text", async () => {
        // Arrange
        const testDigest = "xyz789abc123";

        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("AnotherComponent", "another:v2");

        mockGetComponentById({
          digest: testDigest,
          text: componentText,
        });

        const discoverableRef = { digest: testDigest };

        // Act
        const result = await hydrateComponentReference(discoverableRef);

        // Assert
        expect(localforage.getComponentById).toHaveBeenCalledWith(
          `component-${testDigest}`,
        );
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.name).toBe("AnotherComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
      });

      it("should hydrate component from storage when stored component contains only spec", async () => {
        // Arrange
        const testDigest = "spec123only456";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("SpecOnlyComponent", "spec-only:latest");

        mockGetComponentById({
          digest: testDigest,
          spec: componentSpec,
        });

        const discoverableRef = { digest: testDigest };

        // Act
        const result = await hydrateComponentReference(discoverableRef);

        // Assert
        expect(localforage.getComponentById).toHaveBeenCalledWith(
          `component-${testDigest}`,
        );
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.name).toBe("SpecOnlyComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
      });

      it("should generate a default name when spec doesn't have a name", async () => {
        // Arrange
        const testDigest = "noname789xyz";
        const { spec: componentSpec } = prepareComponentContent(
          undefined,
          "noname:latest",
        );

        mockGetComponentById({
          digest: testDigest,
          spec: componentSpec,
        });

        const discoverableRef = { digest: testDigest };

        // Act
        const result = await hydrateComponentReference(discoverableRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.name).toMatch(/^component-[a-f0-9]{8}$/); // Should be component-{first 8 chars of digest}
        expect(result?.spec).toEqual(componentSpec);
      });

      it("should return null when stored component has invalid data", async () => {
        // Arrange
        const testDigest = "invalid123data";
        mockGetComponentById({
          digest: testDigest,
          text: undefined,
          spec: undefined,
          data: "",
        });

        const discoverableRef = { digest: testDigest };

        // Act
        const result = await hydrateComponentReference(discoverableRef);

        // Assert
        expect(localforage.getComponentById).toHaveBeenCalledWith(
          `component-${testDigest}`,
        );
        expect(result).toBeNull();
      });

      it("should preserve existing storage data when saving hydrated component", async () => {
        // Arrange
        const testDigest = "preserve123data";
        const { text: componentText } = prepareComponentContent(
          "PreserveComponent",
          "preserve:latest",
        );

        const existingCreatedAt = Date.now() - 10000;
        mockGetComponentById({
          digest: testDigest,
          url: "https://example.com/component.yaml",
          text: componentText,
          createdAt: existingCreatedAt,
          updatedAt: Date.now() - 5000,
          customField: "should-be-preserved",
        });

        const discoverableRef = { digest: testDigest };

        // Act
        const result = await hydrateComponentReference(discoverableRef);

        // Assert
        expect(result).not.toBeNull();
        expect(localforage.saveComponent).toHaveBeenCalledWith(
          expect.objectContaining({
            id: expect.stringMatching(/^component-[a-f0-9]+$/), // Generated digest ID
            createdAt: existingCreatedAt, // Should preserve original createdAt
            customField: "should-be-preserved", // Should preserve custom fields
          }),
        );
      });
    });

    describe("when digest is not known (component not in storage)", () => {
      it("should return null when component is not found in storage", async () => {
        // Arrange
        const testDigest = "notfound123xyz";
        const discoverableRef = {
          digest: testDigest,
        };

        mockGetComponentById();

        // Act
        const result = await hydrateComponentReference(discoverableRef);

        // Assert
        expect(localforage.getComponentById).toHaveBeenCalledWith(
          `component-${testDigest}`,
        );
        expect(result).toBeNull();
      });

      it("should fallback to hydration process by URL", async () => {
        // Arrange
        const testDigest = "notfound123xyz";
        const discoverableRef = {
          digest: testDigest,
          url: "https://example.com/component.yaml",
        };

        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("NotFoundComponent", "notfound:v1");

        mockGetComponentById();
        mockGetComponentByUrl({
          url: "https://example.com/component.yaml",
          data: componentText,
        });

        // Act
        const result = await hydrateComponentReference(discoverableRef);

        // Assert
        expect(localforage.getComponentById).toHaveBeenCalledWith(
          `component-${testDigest}`,
        );
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.name).toBe("NotFoundComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
        expect(localforage.saveComponent).toHaveBeenCalled();
      });

      it("should handle getComponentById throwing an error gracefully", async () => {
        // Arrange
        const testDigest = "error123case";
        const discoverableRef = { digest: testDigest };

        mockGetComponentMockError(new Error("Storage error"));

        // Act
        const result = await hydrateComponentReference(discoverableRef);

        // Assert
        expect(localforage.getComponentById).toHaveBeenCalledWith(
          `component-${testDigest}`,
        );
        expect(result).toBeNull();
      });
    });
  });

  describe("LoadableComponentReference", () => {
    beforeEach(() => {
      // Mock fetch globally
      global.fetch = vi.fn();
    });

    describe("when URL is cached in storage", () => {
      it("should hydrate component from cached URL data", async () => {
        // Arrange
        const testUrl = "https://example.com/component.yaml";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("CachedComponent", "cached:v1");

        mockGetComponentByUrl({
          url: testUrl,
          data: componentText,
        });

        const loadableRef = { url: testUrl };

        // Act
        const result = await hydrateComponentReference(loadableRef);

        // Assert
        expect(localforage.getComponentByUrl).toHaveBeenCalledWith(testUrl);
        expect(global.fetch).not.toHaveBeenCalled();
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.name).toBe("CachedComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
        expect(result?.url).toBe(testUrl);
        await waitFor(() => {
          expect(localforage.saveComponent).toHaveBeenCalled();
        });
      });

      it("should handle cached component without a name", async () => {
        // Arrange
        const testUrl = "https://example.com/noname.yaml";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent(undefined, "noname:latest");

        mockGetComponentByUrl({
          url: testUrl,
          data: componentText,
        });

        const loadableRef = { url: testUrl };

        // Act
        const result = await hydrateComponentReference(loadableRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.name).toMatch(/^component-[a-f0-9]{8}$/);
        expect(result?.spec).toEqual(componentSpec);
      });
    });

    describe("when URL is not cached (fetch from network)", () => {
      it("should fetch and hydrate component from URL", async () => {
        // Arrange
        const testUrl = "https://example.com/remote-component.yaml";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("RemoteComponent", "remote:v2");

        mockGetComponentByUrl(null); // Not cached
        mockFetchResponse(componentText);

        const loadableRef = { url: testUrl };

        // Act
        const result = await hydrateComponentReference(loadableRef);

        // Assert
        expect(localforage.getComponentByUrl).toHaveBeenCalledWith(testUrl);
        expect(global.fetch).toHaveBeenCalledWith(testUrl);
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.name).toBe("RemoteComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
        expect(localforage.saveComponent).toHaveBeenCalled();
      });

      it("should handle fetch network errors gracefully", async () => {
        // Arrange
        const testUrl = "https://example.com/error-component.yaml";

        mockGetComponentByUrl(null); // Not cached
        mockFetchError(new Error("Network error"));

        const loadableRef = { url: testUrl };

        // Act
        const result = await hydrateComponentReference(loadableRef);

        // Assert
        expect(localforage.getComponentByUrl).toHaveBeenCalledWith(testUrl);
        expect(global.fetch).toHaveBeenCalledWith(testUrl);
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });

      it("should handle non-ok fetch responses", async () => {
        // Arrange
        const testUrl = "https://example.com/404-component.yaml";

        mockGetComponentByUrl(null); // Not cached
        mockFetchResponse("", { ok: false, statusText: "Not Found" });

        const loadableRef = { url: testUrl };

        // Act
        const result = await hydrateComponentReference(loadableRef);

        // Assert
        expect(localforage.getComponentByUrl).toHaveBeenCalledWith(testUrl);
        expect(global.fetch).toHaveBeenCalledWith(testUrl);
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });

      it("should handle relative URL", async () => {
        // Arrange
        const testUrl = "/remote-component.yaml";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("RemoteComponent", "remote:v2");

        mockGetComponentByUrl(null); // Not cached
        mockFetchResponse(componentText);

        const loadableRef = { url: testUrl };

        // Act
        const result = await hydrateComponentReference(loadableRef);

        // Assert
        expect(localforage.getComponentByUrl).toHaveBeenCalledWith(testUrl);
        expect(global.fetch).toHaveBeenCalledWith(testUrl);
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.name).toBe("RemoteComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
        expect(localforage.saveComponent).toHaveBeenCalled();
      });
    });

    describe("when remote component text is invalid", () => {
      it("should return null for invalid YAML", async () => {
        // Arrange
        const testUrl = "https://example.com/invalid.yaml";
        const invalidYaml = "{ invalid: yaml: content }}}";

        mockGetComponentByUrl({
          url: testUrl,
          data: invalidYaml,
        });

        const loadableRef = { url: testUrl };

        // Act
        const result = await hydrateComponentReference(loadableRef);

        // Assert
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });

      it("should return null for empty component text", async () => {
        // Arrange
        const testUrl = "https://example.com/empty.yaml";

        mockGetComponentByUrl({
          url: testUrl,
          data: "",
        });

        const loadableRef = { url: testUrl };

        // Act
        const result = await hydrateComponentReference(loadableRef);

        // Assert
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });
    });

    describe("when URL and digest are both present", () => {
      it("should prioritize digest over URL if component exists by digest", async () => {
        // Arrange
        const testUrl = "https://example.com/component.yaml";
        const testDigest = "priority123test";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("DigestPriority", "digest:v1");

        mockGetComponentById({
          digest: testDigest,
          text: componentText,
          spec: componentSpec,
        });

        const mixedRef = { url: testUrl, digest: testDigest };

        // Act
        const result = await hydrateComponentReference(mixedRef);

        // Assert
        expect(localforage.getComponentById).toHaveBeenCalledWith(
          `component-${testDigest}`,
        );
        expect(localforage.getComponentByUrl).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(result).not.toBeNull();
        expect(result?.name).toBe("DigestPriority");
      });

      it("should fall back to URL if digest not found", async () => {
        // Arrange
        const testUrl = "https://example.com/fallback.yaml";
        const testDigest = "notfound999";
        const { text: componentText } = prepareComponentContent(
          "FallbackComponent",
          "fallback:v1",
        );

        mockGetComponentById(null); // Digest not found
        mockGetComponentByUrl({
          url: testUrl,
          data: componentText,
        });

        const mixedRef = { url: testUrl, digest: testDigest };

        // Act
        const result = await hydrateComponentReference(mixedRef);

        // Assert
        expect(localforage.getComponentById).toHaveBeenCalledWith(
          `component-${testDigest}`,
        );
        expect(localforage.getComponentByUrl).toHaveBeenCalledWith(testUrl);
        expect(result).not.toBeNull();
        expect(result?.name).toBe("FallbackComponent");
      });
    });

    describe("when saving hydrated component", () => {
      it("should preserve URL in saved component", async () => {
        // Arrange
        const testUrl = "https://example.com/preserve-url.yaml";
        const { text: componentText } = prepareComponentContent(
          "PreserveUrlComponent",
          "preserve:v1",
        );

        mockGetComponentByUrl({
          url: testUrl,
          data: componentText,
        });

        const loadableRef = { url: testUrl };

        // Act
        const result = await hydrateComponentReference(loadableRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.url).toBe(testUrl);
        expect(localforage.saveComponent).toHaveBeenCalledWith(
          expect.objectContaining({
            url: testUrl,
            data: componentText,
          }),
        );
      });

      it("should not overwrite existing component data when saving", async () => {
        // Arrange
        const testUrl = "https://example.com/existing.yaml";
        const { text: componentText } = prepareComponentContent(
          "ExistingComponent",
          "existing:v1",
        );

        const existingCreatedAt = Date.now() - 20000;
        const existingCustomData = { customField: "preserve-me" };

        mockGetComponentByUrl({
          url: testUrl,
          data: componentText,
        });

        // Mock the existing component lookup during save
        vi.mocked(localforage.getComponentById).mockResolvedValueOnce(
          createStoredComponent({
            digest: "existing-digest",
            url: testUrl,
            text: componentText,
            createdAt: existingCreatedAt,
            ...existingCustomData,
          }),
        );

        const loadableRef = { url: testUrl };

        // Act
        const result = await hydrateComponentReference(loadableRef);

        // Assert
        expect(result).not.toBeNull();
        expect(localforage.saveComponent).toHaveBeenCalledWith(
          expect.objectContaining({
            createdAt: existingCreatedAt,
            customField: "preserve-me",
          }),
        );
      });
    });
  });

  describe("PartialContentfulComponentReference", () => {
    describe("when reference contains text only (TextOnlyComponentReference)", () => {
      it("should hydrate component from provided text and generate digest", async () => {
        // Arrange
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("TextComponent", "text:v1");

        // Must have spec === undefined for TextOnlyComponentReference
        const partialRef = { text: componentText, spec: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.digest).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
        expect(result?.name).toBe("TextComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
        expect(localforage.saveComponent).toHaveBeenCalled();
      });

      it("should handle text without component name", async () => {
        // Arrange
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent(undefined, "noname:v1");

        const partialRef = { text: componentText, spec: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.name).toMatch(/^component-[a-f0-9]{8}$/);
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
      });

      it("should return null for invalid YAML text", async () => {
        // Arrange
        const invalidYaml = "{ invalid: yaml: : content }}}";
        const partialRef = { text: invalidYaml, spec: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });

      it("should return null for empty text", async () => {
        // Arrange
        const partialRef = { text: "", spec: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });

      it("should handle text with only whitespace", async () => {
        // Arrange
        const partialRef = { text: "   \n\t  ", spec: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });
    });

    describe("when reference contains spec only (SpecOnlyComponentReference)", () => {
      it("should hydrate component from provided spec and generate digest", async () => {
        // Arrange
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("SpecComponent", "spec:v2");

        // Must not have text for SpecOnlyComponentReference
        const partialRef = { spec: componentSpec, text: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.digest).toMatch(/^[a-f0-9]{64}$/);
        expect(result?.name).toBe("SpecComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
        expect(localforage.saveComponent).toHaveBeenCalled();
      });

      it("should handle spec without component name", async () => {
        // Arrange
        const componentSpec = createComponentSpec(undefined, "unnamed:latest");
        const partialRef = { spec: componentSpec, text: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.name).toMatch(/^component-[a-f0-9]{8}$/);
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(yaml.dump(componentSpec));
      });

      it("should return null for invalid spec object", async () => {
        // Arrange
        const invalidSpec = { invalid: "not a valid component spec" } as any;
        const partialRef = { spec: invalidSpec, text: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });

      it("should return null for null spec", async () => {
        // Arrange
        const partialRef = { spec: null as any, text: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });

      it("should return null for undefined spec", async () => {
        // Arrange
        const partialRef = { spec: undefined as any, text: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });
    });

    describe("when reference contains text with URL", () => {
      it("should hydrate from text and preserve URL", async () => {
        // Arrange
        const testUrl = "https://example.com/partial.yaml";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("UrlTextComponent", "urltext:v1");

        // Text-only with URL (spec must be undefined)
        const partialRef = {
          text: componentText,
          url: testUrl,
          spec: undefined,
        };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.url).toBe(testUrl);
        expect(result?.name).toBe("UrlTextComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(localforage.saveComponent).toHaveBeenCalled();
      });
    });

    describe("when reference contains spec with digest", () => {
      it("should hydrate from spec and ignore provided digest", async () => {
        // Arrange
        const providedDigest = "provideddigest123";
        const { spec: componentSpec } = prepareComponentContent(
          "DigestSpecComponent",
          "digestspec:v1",
        );

        // Spec-only with digest (text must be undefined)
        const partialRef = {
          spec: componentSpec,
          digest: providedDigest,
          text: undefined,
        };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.digest).not.toBe(providedDigest); // Should generate new digest
        expect(result?.digest).toMatch(/^[a-f0-9]{64}$/); // Should be a SHA-256 hash
        expect(result?.name).toBe("DigestSpecComponent");
        expect(result?.spec).toEqual(componentSpec);
      });
    });

    describe("error handling", () => {
      it("should handle crypto.subtle.digest errors gracefully", async () => {
        // Arrange
        const { text: componentText } = prepareComponentContent(
          "ErrorComponent",
          "error:v1",
        );

        vi.spyOn(globalThis.crypto.subtle, "digest").mockRejectedValueOnce(
          new Error("Crypto error"),
        );

        const partialRef = { text: componentText, spec: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });

      it("should handle saveComponent errors gracefully", async () => {
        // Arrange
        const { text: componentText } = prepareComponentContent(
          "SaveErrorComponent",
          "saveerror:v1",
        );

        vi.mocked(localforage.saveComponent).mockRejectedValueOnce(
          new Error("Storage error"),
        );

        const partialRef = { text: componentText, spec: undefined };

        // Act
        const result = await hydrateComponentReference(partialRef);

        // Assert
        expect(result).not.toBeNull(); // Should still return the hydrated component
        expect(result?.name).toBe("SaveErrorComponent");
        await waitFor(() => {
          expect(localforage.saveComponent).toHaveBeenCalled();
        });
      });
    });
  });

  describe("ContentfulComponentReference", () => {
    describe("when reference contains both text and spec", () => {
      it("should hydrate component from provided text and spec and generate digest", async () => {
        // Arrange
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("ContentfulComponent", "contentful:v1");

        const contentfulRef = { text: componentText, spec: componentSpec };

        // Act
        const result = await hydrateComponentReference(contentfulRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.digest).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
        expect(result?.name).toBe("ContentfulComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(componentText);
        expect(localforage.saveComponent).toHaveBeenCalled();
      });

      it.todo(
        "should use text over spec when they differ" /** todo: decide if this case is valid */,
      );

      it("should handle both text and spec without component name", async () => {
        // Arrange
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent(undefined, "noname:v1");

        const contentfulRef = { text: componentText, spec: componentSpec };

        // Act
        const result = await hydrateComponentReference(contentfulRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.name).toMatch(/^component-[a-f0-9]{8}$/);
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(yaml.dump(componentSpec)); // Text regenerated from spec
      });

      it("should prefer YAML spec name over provided component name", async () => {
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("Filter text two", "filter:v2");

        const contentfulRef = {
          text: componentText,
          spec: componentSpec,
          name: "Filter text",
        };

        const result = await hydrateComponentReference(contentfulRef);

        expect(result).not.toBeNull();
        expect(result?.name).toBe("Filter text two");
      });

      it("should preserve URL when provided with text and spec", async () => {
        // Arrange
        const testUrl = "https://example.com/contentful.yaml";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("UrlContentfulComponent", "urlcontentful:v1");

        const contentfulRef = {
          text: componentText,
          spec: componentSpec,
          url: testUrl,
        };

        // Act
        const result = await hydrateComponentReference(contentfulRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.url).toBe(testUrl);
        expect(result?.name).toBe("UrlContentfulComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(localforage.saveComponent).toHaveBeenCalledWith(
          expect.objectContaining({
            url: testUrl,
          }),
        );
      });

      it("should generate new digest ignoring provided digest", async () => {
        // Arrange
        const providedDigest = "provideddigest456";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("DigestContentfulComponent", "digest:v1");

        const contentfulRef = {
          text: componentText,
          spec: componentSpec,
          digest: providedDigest,
        };

        // Act
        const result = await hydrateComponentReference(contentfulRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.digest).toBeDefined();
        expect(result?.digest).not.toBe(providedDigest); // Should generate new digest
        expect(result?.digest).toMatch(/^[a-f0-9]{64}$/);
        expect(result?.name).toBe("DigestContentfulComponent");
      });

      it.todo(
        "should return null when text is invalid YAML but valid spec" /** todo: decide how we should handle this */,
      );

      it("should handle empty text with valid spec", async () => {
        // Arrange
        const { spec: componentSpec } = prepareComponentContent(
          "EmptyTextComponent",
          "emptytext:v1",
        );

        const contentfulRef = {
          text: "",
          spec: componentSpec,
        };

        // Act
        const result = await hydrateComponentReference(contentfulRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.name).toBe("EmptyTextComponent");
        expect(result?.spec).toEqual(componentSpec);
        expect(result?.text).toBe(yaml.dump(componentSpec)); // Text generated from spec
      });

      it("should preserve all properties when saving", async () => {
        // Arrange
        const testUrl = "https://example.com/preserve-all.yaml";
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("PreserveAllComponent", "preserve:v1");

        const contentfulRef = {
          text: componentText,
          spec: componentSpec,
          url: testUrl,
          customProp: "should-be-ignored", // Extra properties should be ignored
        };

        // Act
        const result = await hydrateComponentReference(contentfulRef);

        // Assert
        expect(result).not.toBeNull();
        await waitFor(() => {
          expect(localforage.saveComponent).toHaveBeenCalledWith(
            expect.objectContaining({
              url: testUrl,
              data: yaml.dump(componentSpec),
            }),
          );
        });
      });

      it("should handle crypto.subtle.digest errors gracefully", async () => {
        // Arrange
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("ErrorComponent", "error:v1");

        vi.spyOn(globalThis.crypto.subtle, "digest").mockRejectedValueOnce(
          new Error("Crypto error"),
        );

        const contentfulRef = { text: componentText, spec: componentSpec };

        // Act
        const result = await hydrateComponentReference(contentfulRef);

        // Assert
        expect(result).toBeNull();
        expect(localforage.saveComponent).not.toHaveBeenCalled();
      });

      it("should handle saveComponent errors gracefully", async () => {
        // Arrange
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent("SaveErrorComponent", "saveerror:v1");

        vi.mocked(localforage.saveComponent).mockRejectedValueOnce(
          new Error("Storage error"),
        );

        const contentfulRef = { text: componentText, spec: componentSpec };

        // Act
        const result = await hydrateComponentReference(contentfulRef);

        // Assert
        expect(result).not.toBeNull(); // Should still return the hydrated component
        expect(result?.name).toBe("SaveErrorComponent");
        expect(result?.spec).toEqual(componentSpec);
        await waitFor(() => {
          expect(localforage.saveComponent).toHaveBeenCalled();
        });
      });

      it("should handle complex nested spec structures", async () => {
        // Arrange
        const complexSpec: ComponentSpec = {
          name: "ComplexComponent",
          implementation: {
            container: {
              image: "complex:latest",
              command: ["python", "-m", "complex_module"],
              args: ["--verbose", "--config", "/etc/config.yaml"],
            },
          },
          inputs: [
            {
              name: "input1",
              type: "String",
              description: "First input",
            },
            {
              name: "input2",
              type: "Dataset",
              description: "Second input",
            },
          ],
          outputs: [
            {
              name: "output1",
              type: "Model",
              description: "First output",
            },
          ],
        };
        const complexText = yaml.dump(complexSpec);

        const contentfulRef = {
          text: complexText,
          spec: complexSpec,
        };

        // Act
        const result = await hydrateComponentReference(contentfulRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.name).toBe("ComplexComponent");
        expect(result?.spec).toEqual(complexSpec);
        expect(result?.text).toBe(complexText);
      });

      it("should handle spec with special characters in name", async () => {
        // Arrange
        const { text: componentText, spec: componentSpec } =
          prepareComponentContent(
            "Component-With_Special.Characters@123",
            "special:v1",
          );

        const contentfulRef = { text: componentText, spec: componentSpec };

        // Act
        const result = await hydrateComponentReference(contentfulRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.name).toBe("Component-With_Special.Characters@123");
        expect(result?.spec).toEqual(componentSpec);
      });

      it("should handle very large text and spec", async () => {
        // Arrange
        const largeDescription = "x".repeat(10000);
        const largeSpec: ComponentSpec = {
          name: "LargeComponent",
          description: largeDescription,
          implementation: {
            container: {
              image: "large:latest",
            },
          },
        };
        const largeText = yaml.dump(largeSpec);

        const contentfulRef = {
          text: largeText,
          spec: largeSpec,
        };

        // Act
        const result = await hydrateComponentReference(contentfulRef);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.name).toBe("LargeComponent");
        expect(result?.spec?.description).toBe(largeDescription);
      });
    });
  });
});

// Helper functions
function createComponentSpec(
  name?: string,
  image = "default:latest",
): ComponentSpec {
  const spec: ComponentSpec = {
    implementation: {
      container: {
        image,
      },
    },
  };

  if (name) {
    spec.name = name;
  }

  return spec;
}

function prepareComponentContent(
  name?: string,
  image = "default:latest",
): { text: string; spec: ComponentSpec } {
  const spec = createComponentSpec(name, image);
  return {
    text: yaml.dump(spec),
    spec,
  };
}

function createStoredComponent({
  digest,
  url = "",
  text,
  spec,
  data,
  createdAt = Date.now(),
  updatedAt = Date.now(),
  ...rest
}: {
  digest: string;
  url?: string;
  text?: string;
  spec?: ComponentSpec;
  data?: string;
  createdAt?: number;
  updatedAt?: number;
  customField?: string;
}) {
  return {
    id: `component-${digest}`,
    url,
    data: data ?? (text || (spec ? yaml.dump(spec) : "")),
    text,
    spec,
    createdAt,
    updatedAt,
    ...rest,
  };
}

function mockGetComponentById(
  options?: Parameters<typeof createStoredComponent>[0] | null,
) {
  const storedComponent =
    options && options !== null ? createStoredComponent(options) : null;

  vi.mocked(localforage.getComponentById).mockResolvedValue(storedComponent);
  return storedComponent;
}

function mockGetComponentMockError(error: Error) {
  vi.mocked(localforage.getComponentById).mockRejectedValue(error);
}

function mockGetComponentByUrl(
  data:
    | {
        url: string;
        data: string;
        createdAt?: number;
        updatedAt?: number;
      }
    | null
    | undefined,
) {
  vi.mocked(localforage.getComponentByUrl).mockResolvedValue(
    data
      ? {
          id: `component-url-${Date.now()}`,
          url: data.url,
          data: data.data,
          createdAt: data.createdAt ?? Date.now(),
          updatedAt: data.updatedAt ?? Date.now(),
        }
      : null,
  );
}

function mockFetchResponse(
  text: string,
  options: { ok?: boolean; statusText?: string } = {},
) {
  const response = {
    ok: options.ok ?? true,
    headers: new Headers(),
    statusText: options.statusText ?? "OK",
    text: vi.fn().mockResolvedValue(text),
  };
  vi.mocked(global.fetch).mockResolvedValue(response as unknown as Response);
}

function mockFetchError(error: Error) {
  vi.mocked(global.fetch).mockRejectedValue(error);
}
