import yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentLibrary } from "@/types/componentLibrary";
import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";
import { generateDigest } from "@/utils/componentStore";
import * as localforage from "@/utils/localforage";

import {
  fetchAndStoreComponent,
  fetchAndStoreComponentByUrl,
  fetchAndStoreComponentLibrary,
  getExistingAndNewUserComponent,
  inputsWithInvalidArguments,
  parseComponentData,
} from "./componentService";

vi.mock("@/utils/localforage", () => ({
  componentExistsByUrl: vi.fn(),
  getComponentByUrl: vi.fn(),
  getComponentById: vi.fn(),
  saveComponent: vi.fn(),
  getAllUserComponents: vi.fn(),
}));

vi.mock("@/utils/cache", () => ({
  loadObjectFromYamlData: vi.fn(),
}));

vi.mock("@/appSettings", () => ({
  COMPONENT_LIBRARY_FILE: "component-library.yaml",
  getAppSettings: vi.fn().mockReturnValue({
    componentLibraryUrl: "/component-library.yaml",
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

Object.defineProperty(global, "crypto", {
  value: {
    subtle: {
      digest: vi.fn(),
    },
  },
});

describe("componentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockHashBuffer = new ArrayBuffer(32);
    vi.mocked(crypto.subtle.digest).mockResolvedValue(mockHashBuffer);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("generateDigest", () => {
    it("should generate a SHA-256 digest from text", async () => {
      const mockHashBuffer = new ArrayBuffer(32);
      const mockArray = new Uint8Array(mockHashBuffer);
      mockArray.fill(255);

      vi.mocked(crypto.subtle.digest).mockResolvedValue(mockHashBuffer);

      const result = await generateDigest("test text");

      expect(crypto.subtle.digest).toHaveBeenCalledTimes(1);
      const [algorithm, data] = vi.mocked(crypto.subtle.digest).mock.calls[0];

      expect(algorithm).toBe("SHA-256");
      expect(data.constructor.name).toBe("Uint8Array");
      expect((data as Uint8Array).length).toBe(9);
      expect(result).toBe("f".repeat(64));
    });
  });

  describe("parseComponentData", () => {
    it("should parse valid YAML data", () => {
      const yamlData = "name: test-component\nversion: 1.2";
      const result = parseComponentData(yamlData);

      expect(result).toEqual({
        name: "test-component",
        version: 1.2,
      });
    });

    it("should return null for invalid YAML", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = parseComponentData("invalid: yaml: data: -");

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error parsing component data:",
        expect.any(Error),
      );
    });
  });

  describe("fetchAndStoreComponentByUrl", () => {
    const mockComponentSpec: ComponentSpec = {
      name: "test-component",
      implementation: { container: { image: "test" } },
    };

    it("should return cached component if it exists", async () => {
      const url = "https://example.com/component.yaml";
      const cachedComponent = {
        id: "cached-1",
        url,
        data: yaml.dump(mockComponentSpec),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(localforage.componentExistsByUrl).mockResolvedValue(true);
      vi.mocked(localforage.getComponentByUrl).mockResolvedValue(
        cachedComponent,
      );

      const result = await fetchAndStoreComponentByUrl(url);

      expect(result).toEqual(mockComponentSpec);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fetch from URL if not cached", async () => {
      const url = "https://example.com/component.yaml";
      const yamlContent = yaml.dump(mockComponentSpec);

      vi.mocked(localforage.componentExistsByUrl).mockResolvedValue(false);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers(),
        text: () => Promise.resolve(yamlContent),
      } as Response);

      const result = await fetchAndStoreComponentByUrl(url);

      expect(mockFetch).toHaveBeenCalledWith(url);
      expect(localforage.saveComponent).toHaveBeenCalledWith({
        id: expect.stringMatching(/^component-\w+$/),
        url,
        data: yamlContent,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      });
      expect(result).toEqual(mockComponentSpec);
    });

    it("should handle fetch errors", async () => {
      const url = "https://example.com/component.yaml";
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      vi.mocked(localforage.componentExistsByUrl).mockResolvedValue(false);
      mockFetch.mockResolvedValue({
        ok: false,
        headers: new Headers(),
        statusText: "Not Found",
      } as Response);

      const result = await fetchAndStoreComponentByUrl(url);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        `Error fetching component from URL ${url}:`,
        expect.any(Error),
      );
    });

    it("should store raw data even if parsing fails", async () => {
      const url = "https://example.com/component.yaml";
      const invalidYaml = "invalid: yaml: content: -";
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      vi.mocked(localforage.componentExistsByUrl).mockResolvedValue(false);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers(),
        text: () => Promise.resolve(invalidYaml),
      } as Response);

      const result = await fetchAndStoreComponentByUrl(url);

      expect(localforage.saveComponent).toHaveBeenCalledWith({
        id: expect.stringMatching(/^component-\w+$/),
        url,
        data: invalidYaml,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      });
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        `Error parsing component at ${url}:`,
        expect.any(Error),
      );
    });

    it("should handle JSON response with text field from backend API", async () => {
      const url = "https://api.example.com/component/123";
      const yamlContent = yaml.dump(mockComponentSpec);
      const jsonResponse = { text: yamlContent };

      vi.mocked(localforage.componentExistsByUrl).mockResolvedValue(false);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: () => Promise.resolve(jsonResponse),
        text: () => Promise.resolve(JSON.stringify(jsonResponse)),
      } as Response);

      const result = await fetchAndStoreComponentByUrl(url);

      expect(mockFetch).toHaveBeenCalledWith(url);
      expect(localforage.saveComponent).toHaveBeenCalledWith({
        id: expect.stringMatching(/^component-\w+$/),
        url,
        data: yamlContent,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      });
      expect(result).toEqual(mockComponentSpec);
    });

    it("should handle JSON response with invalid YAML in text field", async () => {
      const url = "https://api.example.com/component/789";
      const invalidYaml = "invalid: yaml: content: -";
      const jsonResponse = { text: invalidYaml };
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      vi.mocked(localforage.componentExistsByUrl).mockResolvedValue(false);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: () => Promise.resolve(jsonResponse),
        text: () => Promise.resolve(JSON.stringify(jsonResponse)),
      } as Response);

      const result = await fetchAndStoreComponentByUrl(url);

      expect(localforage.saveComponent).toHaveBeenCalledWith({
        id: expect.stringMatching(/^component-\w+$/),
        url,
        data: invalidYaml,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      });
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        `Error parsing component at ${url}:`,
        expect.any(Error),
      );
    });

    it("should use cached JSON-sourced component on subsequent calls", async () => {
      const url = "https://api.example.com/component/cached";
      const yamlContent = yaml.dump(mockComponentSpec);
      const cachedComponent = {
        id: "cached-json-1",
        url,
        data: yamlContent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(localforage.componentExistsByUrl).mockResolvedValue(true);
      vi.mocked(localforage.getComponentByUrl).mockResolvedValue(
        cachedComponent,
      );

      const result = await fetchAndStoreComponentByUrl(url);

      expect(result).toEqual(mockComponentSpec);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("fetchAndStoreComponent", () => {
    const mockComponentSpec: ComponentSpec = {
      name: "test-component",
      implementation: { container: { image: "test" } },
    };

    it("should handle component with text content", async () => {
      const yamlText = yaml.dump(mockComponentSpec);
      const component: ComponentReference = {
        text: yamlText,
      };

      const result = await fetchAndStoreComponent(component);

      expect(localforage.saveComponent).toHaveBeenCalledWith({
        id: expect.stringMatching(/^component-\w+$/),
        url: "",
        data: yamlText,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      });
      expect(result).toEqual(mockComponentSpec);
    });

    it("should handle component with URL", async () => {
      const url = "https://example.com/component.yaml";
      const yamlText = yaml.dump(mockComponentSpec);
      const component: ComponentReference = { url };

      vi.mocked(localforage.getComponentByUrl).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers(),
        text: () => Promise.resolve(yamlText),
      } as Response);

      const result = await fetchAndStoreComponent(component);

      expect(result).toEqual(mockComponentSpec);
    });

    it("should handle component with spec object", async () => {
      const component: ComponentReference = {
        spec: mockComponentSpec,
      };

      const result = await fetchAndStoreComponent(component);

      expect(localforage.saveComponent).toHaveBeenCalledWith({
        id: expect.stringMatching(/^component-\w+$/),
        url: "",
        data: yaml.dump(mockComponentSpec),
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      });
      expect(result).toEqual(mockComponentSpec);
    });

    it("should fallback to existing spec if text parsing fails", async () => {
      const component: ComponentReference = {
        text: "invalid: yaml: content: -",
        spec: mockComponentSpec,
      };
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await fetchAndStoreComponent(component);

      expect(result).toEqual(mockComponentSpec);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error parsing component text:",
        expect.any(Error),
      );
    });

    it("should handle empty component gracefully", async () => {
      const component: ComponentReference = {};

      const result = await fetchAndStoreComponent(component);

      expect(result).toBeNull();
      expect(localforage.saveComponent).not.toHaveBeenCalled();
    });

    it("should not override existing component if component already exists", async () => {
      const yamlText = yaml.dump(mockComponentSpec);
      const id = `component-${await generateDigest(yamlText)}`;

      vi.mocked(localforage.getComponentById).mockResolvedValue({
        id,
        data: yamlText,
        url: "",
        createdAt: 1,
        updatedAt: 1,
      });

      const component: ComponentReference = {
        text: yamlText,
      };

      const result = await fetchAndStoreComponent(component);

      expect(localforage.saveComponent).not.toHaveBeenCalled();
      expect(result).toEqual(mockComponentSpec);
    });
  });

  describe("getExistingAndNewUserComponent", () => {
    const mockComponent: ComponentSpec = {
      name: "test-component",
      implementation: { container: { image: "test" } },
    };

    it("should return new component when no existing component found", async () => {
      const componentData = yaml.dump(mockComponent);

      vi.mocked(localforage.getAllUserComponents).mockResolvedValue([]);

      const result = await getExistingAndNewUserComponent(componentData);

      expect(result).toEqual({
        existingComponent: undefined,
        newComponent: mockComponent,
      });
    });

    it("should return existing component when found with different digest", async () => {
      const componentData = yaml.dump(mockComponent);
      const existingComponent = {
        id: "existing-1",
        name: "test-component",
        componentRef: { digest: "different-digest" },
      };

      vi.mocked(localforage.getAllUserComponents).mockResolvedValue([
        existingComponent,
      ] as any);

      const result = await getExistingAndNewUserComponent(componentData);

      expect(result).toEqual({
        existingComponent,
        newComponent: mockComponent,
      });
    });
  });

  describe("inputsWithInvalidArguments", () => {
    it("should return empty array when no inputs or taskSpec", () => {
      expect(inputsWithInvalidArguments(undefined, undefined)).toEqual([]);
      expect(inputsWithInvalidArguments([], undefined)).toEqual([]);
      expect(inputsWithInvalidArguments(undefined, {} as any)).toEqual([]);
    });

    it("should return names of required inputs not defined in arguments", () => {
      const inputs = [
        { name: "required-input", optional: false },
        { name: "optional-input", optional: true },
        { name: "default-input", default: "value" },
        { name: "defined-input", optional: false },
      ];
      const taskSpec = {
        arguments: {
          "defined-input": "some-value",
        },
      };

      const result = inputsWithInvalidArguments(inputs as any, taskSpec as any);

      expect(result).toEqual(["required-input"]);
    });

    it("should handle inputs with both optional and default", () => {
      const inputs = [
        { name: "optional-with-default", optional: true, default: "value" },
        { name: "required-missing", optional: false },
      ];
      const taskSpec = { arguments: {} };

      const result = inputsWithInvalidArguments(inputs as any, taskSpec as any);

      expect(result).toEqual(["required-missing"]);
    });
  });

  describe("fetchAndStoreComponentLibrary", () => {
    const mockLibrary: ComponentLibrary = {
      folders: [
        {
          name: "test-folder",
          components: [
            { name: "component1", url: "https://example.com/comp1.yaml" },
          ],
          folders: [],
        },
      ],
    };

    it("should fetch and store component library successfully", async () => {
      const { loadObjectFromYamlData } = await import("@/utils/cache");
      const componentYaml = yaml.dump({
        name: "component1",
        implementation: { container: { image: "test" } },
      });

      // First mock for fetching the library
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as Response);

      // Mock for fetching individual component from library
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        text: () => Promise.resolve(componentYaml),
      } as Response);

      vi.mocked(loadObjectFromYamlData).mockReturnValue(mockLibrary);
      vi.mocked(localforage.getComponentByUrl).mockResolvedValue(null);

      const result = await fetchAndStoreComponentLibrary();

      expect(result).toEqual(mockLibrary);
      expect(localforage.saveComponent).toHaveBeenCalledWith({
        id: expect.stringMatching(/^library-\d+$/),
        url: "/component-library.yaml",
        data: JSON.stringify(mockLibrary),
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      });
    });

    it("should handle fetch errors and fallback to local storage", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        headers: new Headers(),
        statusText: "Not Found",
      } as Response);

      vi.mocked(localforage.componentExistsByUrl).mockResolvedValue(false);

      await expect(fetchAndStoreComponentLibrary()).rejects.toThrow(
        "Failed to load component library: Not Found",
      );
    });
  });
});
