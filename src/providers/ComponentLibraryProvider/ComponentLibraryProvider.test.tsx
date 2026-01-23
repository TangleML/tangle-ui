import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import yaml from "js-yaml";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ComponentFolder,
  ComponentLibrary,
} from "@/types/componentLibrary";
import type {
  ComponentReference,
  ComponentSpec,
  HydratedComponentReference,
} from "@/utils/componentSpec";
import { USER_COMPONENTS_LIST_NAME } from "@/utils/constants";
import type { UserComponent } from "@/utils/localforage";

const componentDuplicateDialogProps: {
  handleImportComponent?: (content: string) => Promise<void>;
} = {};

vi.mock("@/components/shared/Dialogs/ComponentDuplicateDialog", () => ({
  __esModule: true,
  default: (props: any) => {
    componentDuplicateDialogProps.handleImportComponent =
      props.handleImportComponent;
    return null;
  },
}));

import { ComponentSpecProvider } from "../ComponentSpecProvider";
import { ComponentLibraryProvider, useComponentLibrary } from ".";

// Mock all dependencies
vi.mock("@/services/componentService");
vi.mock("@/utils/componentStore");
vi.mock("@/utils/localforage");
vi.mock("@/utils/getComponentName");
vi.mock("./componentLibrary");

// Import mocked modules
import * as componentLibraryUtils from "@/providers/ComponentLibraryProvider/componentLibrary";
import * as componentStore from "@/utils/componentStore";
import * as getComponentName from "@/utils/getComponentName";
import * as localforage from "@/utils/localforage";

// Mock implementations

const mockFetchUserComponents = vi.mocked(
  componentLibraryUtils.fetchUserComponents,
);
const mockFetchUsedComponents = vi.mocked(
  componentLibraryUtils.fetchUsedComponents,
);
const mockPopulateComponentRefs = vi.mocked(
  componentLibraryUtils.populateComponentRefs,
);
const mockFlattenFolders = vi.mocked(componentLibraryUtils.flattenFolders);
const mockFilterToUniqueByDigest = vi.mocked(
  componentLibraryUtils.filterToUniqueByDigest,
);
const mockImportComponent = vi.mocked(componentStore.importComponent);
const mockDeleteComponentFileFromList = vi.mocked(
  componentStore.deleteComponentFileFromList,
);
const mockGetUserComponentByName = vi.mocked(
  localforage.getUserComponentByName,
);
const mockGetComponentName = vi.mocked(getComponentName.getComponentName);

describe("ComponentLibraryProvider - Component Management", () => {
  const mockComponentSpec: ComponentSpec = {
    name: "test-pipeline",
    implementation: {
      graph: {
        tasks: {},
      },
    },
  };

  const mockComponentLibrary: ComponentLibrary = {
    folders: [
      {
        name: "Test Folder",
        components: [
          {
            name: "test-component",
            digest: "test-digest-1",
            url: "https://example.com/component1.yaml",
            spec: mockComponentSpec,
          },
        ],
        folders: [],
      },
    ],
  };

  const mockUserComponentsFolder: ComponentFolder = {
    name: "User Components",
    components: [
      {
        name: "user-component",
        digest: "user-digest-1",
        spec: mockComponentSpec,
        text: "test yaml content",
      },
    ],
    folders: [],
  };

  const createWrapper = ({ children }: { children: ReactNode }) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return (
      <QueryClientProvider client={queryClient}>
        <ComponentSpecProvider spec={mockComponentSpec}>
          <ComponentLibraryProvider>{children}</ComponentLibraryProvider>
        </ComponentSpecProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    componentDuplicateDialogProps.handleImportComponent = undefined;

    // Setup default mock implementations
    mockFetchUserComponents.mockResolvedValue(mockUserComponentsFolder);
    mockFetchUsedComponents.mockReturnValue({
      name: "Used Components",
      components: [],
      folders: [],
    });
    mockPopulateComponentRefs.mockImplementation((lib) => Promise.resolve(lib));
    mockFlattenFolders.mockImplementation((folder) => {
      if ("folders" in folder) {
        return folder.folders?.flatMap((f) => f.components || []) || [];
      }
      return folder.components || [];
    });
    mockFilterToUniqueByDigest.mockImplementation((components) => components);
    mockGetComponentName.mockImplementation(
      (component) => component.name || "",
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Adding Components", () => {
    it("should successfully add a component to the library", async () => {
      const newComponent: HydratedComponentReference = {
        name: "new-component",
        digest: "new-digest",
        spec: mockComponentSpec,
        text: "new component yaml",
      };

      mockImportComponent.mockResolvedValue(undefined);
      mockFlattenFolders.mockReturnValue([]); // No existing components

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.addToComponentLibrary(newComponent);
      });

      expect(mockImportComponent).toHaveBeenCalledWith(newComponent);
      expect(mockImportComponent).toHaveBeenCalledTimes(1);
    });

    it("should handle duplicate component names by showing confirmation dialog", async () => {
      const newComponent: HydratedComponentReference = {
        name: "duplicate-component",
        digest: "new-digest",
        spec: mockComponentSpec,
        text: "new component yaml",
      };

      const existingComponent: ComponentReference = {
        name: "duplicate-component",
        digest: "existing-digest",
        spec: mockComponentSpec,
        text: "existing component yaml",
      };

      const mockUserComponent: UserComponent = {
        componentRef: existingComponent,
        name: "duplicate-component",
        data: new ArrayBuffer(0),
        creationTime: new Date(),
        modificationTime: new Date(),
      };

      // Mock that there's an existing component with the same name
      mockFlattenFolders.mockReturnValue([existingComponent]);
      mockGetUserComponentByName.mockResolvedValue(mockUserComponent);

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        void result.current.addToComponentLibrary(newComponent);
      });

      // Should not call importComponent directly when there's a duplicate
      expect(mockImportComponent).not.toHaveBeenCalled();
      // Should check for existing user component
      expect(mockGetUserComponentByName).toHaveBeenCalledWith(
        "duplicate-component",
      );
    });

    it("should import renamed component as new without mutating the original", async () => {
      const spec: ComponentSpec = {
        name: "duplicate-component",
        implementation: {
          container: {
            image: "ubuntu:latest",
            command: ["echo", "Hello, World!"],
          },
        },
      };

      const newComponent: HydratedComponentReference = {
        name: "duplicate-component",
        digest: "new-digest",
        spec: {
          ...spec,
        },
        text: yaml.dump(spec),
      };

      const existingComponent: ComponentReference = {
        name: "duplicate-component",
        digest: "existing-digest",
        spec: { ...spec },
        text: yaml.dump(spec),
      };

      const mockUserComponent: UserComponent = {
        componentRef: existingComponent,
        name: "duplicate-component",
        data: new ArrayBuffer(0),
        creationTime: new Date(),
        modificationTime: new Date(),
      };

      mockFlattenFolders.mockReturnValue([existingComponent]);
      mockGetUserComponentByName.mockResolvedValue(mockUserComponent);
      mockImportComponent.mockResolvedValue(undefined);

      // Setup the user components folder to contain the duplicate
      const userComponentsFolderWithDuplicate: ComponentFolder = {
        name: "User Components",
        components: [existingComponent],
        folders: [],
      };

      mockFetchUserComponents.mockImplementation(() =>
        Promise.resolve(userComponentsFolderWithDuplicate),
      );

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await act(async () => {
        await result.current.addToComponentLibrary(newComponent);
      });

      // Wait for the dialog handler to be set up
      await waitFor(() => {
        expect(
          componentDuplicateDialogProps.handleImportComponent,
        ).toBeDefined();
      });

      // Now simulate the import action through the dialog
      const renamedComponentSpec = {
        name: "renamed-duplicate-component",
        ...newComponent.spec,
      };

      const renamedComponentYaml = yaml.dump(renamedComponentSpec);

      await act(async () => {
        await componentDuplicateDialogProps.handleImportComponent!(
          renamedComponentYaml,
        );
      });

      // Verify the component was imported with the renamed text content
      expect(mockImportComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.any(Object),
          text: renamedComponentYaml,
        }),
      );
    });

    it("should add component when no duplicate exists", async () => {
      const newComponent: HydratedComponentReference = {
        name: "unique-component",
        digest: "unique-digest",
        spec: mockComponentSpec,
        text: "unique component yaml",
      };

      mockImportComponent.mockResolvedValue(undefined);
      mockFlattenFolders.mockReturnValue([]); // No existing components

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.addToComponentLibrary(newComponent);
      });

      expect(mockImportComponent).toHaveBeenCalledWith(newComponent);
    });

    it("should dispatch custom event 'tangle.library.componentAdded' when component is added", async () => {
      const newComponent: HydratedComponentReference = {
        name: "event-test-component",
        digest: "event-digest",
        spec: mockComponentSpec,
        text: "event test yaml",
      };

      mockImportComponent.mockResolvedValue(undefined);
      mockFlattenFolders.mockReturnValue([]); // No duplicate

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const eventListener = vi.fn();
      window.addEventListener("tangle.library.componentAdded", eventListener);

      await act(async () => {
        await result.current.addToComponentLibrary(newComponent);
      });

      expect(mockImportComponent).toHaveBeenCalledWith(newComponent);
      expect(eventListener).toHaveBeenCalled();

      // Optional: check event detail contents if relevant
      const eventArg = eventListener.mock.calls[0]?.[0];
      expect(eventArg).toBeInstanceOf(CustomEvent);
      expect(eventArg.detail?.component).toEqual(
        expect.objectContaining(newComponent),
      );

      window.removeEventListener(
        "tangle.library.componentAdded",
        eventListener,
      );
    });
  });

  describe("Removing Components", () => {
    it("should successfully remove a component from the library", async () => {
      const componentToRemove: ComponentReference = {
        name: "component-to-remove",
        digest: "remove-digest",
        spec: mockComponentSpec,
      };

      mockDeleteComponentFileFromList.mockResolvedValue();

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.removeFromComponentLibrary(componentToRemove);
      });

      expect(mockDeleteComponentFileFromList).toHaveBeenCalledWith(
        USER_COMPONENTS_LIST_NAME,
        "component-to-remove",
      );
    });

    it("should handle error when removing component without name", async () => {
      const componentWithoutName: ComponentReference = {
        digest: "no-name-digest",
        spec: mockComponentSpec,
      };

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.removeFromComponentLibrary(componentWithoutName);
      });

      expect(mockDeleteComponentFileFromList).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("does not have a name"),
      );

      consoleSpy.mockRestore();
    });

    it("should handle removal errors gracefully", async () => {
      const componentToRemove: ComponentReference = {
        name: "error-component",
        digest: "error-digest",
        spec: mockComponentSpec,
      };

      const error = new Error("Removal failed");
      mockDeleteComponentFileFromList.mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.removeFromComponentLibrary(componentToRemove);
      });

      expect(mockDeleteComponentFileFromList).toHaveBeenCalledWith(
        USER_COMPONENTS_LIST_NAME,
        "error-component",
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error deleting component:",
        error,
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Component Checks", () => {
    it("should correctly identify user components", async () => {
      const userComponent: ComponentReference = {
        name: "user-component",
        digest: "user-digest-1",
        spec: mockComponentSpec,
      };

      mockFlattenFolders.mockReturnValue([userComponent]);
      mockFilterToUniqueByDigest.mockReturnValue([userComponent]);

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const isUserComponent =
        result.current.checkIfUserComponent(userComponent);
      expect(isUserComponent).toBe(true);
    });

    it("should correctly identify non-user components", async () => {
      const standardComponent: ComponentReference = {
        name: "standard-component",
        digest: "standard-digest",
        spec: mockComponentSpec,
      };

      mockFlattenFolders.mockReturnValue([]); // No user components

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const isUserComponent =
        result.current.checkIfUserComponent(standardComponent);
      expect(isUserComponent).toBe(false);
    });
  });
});
