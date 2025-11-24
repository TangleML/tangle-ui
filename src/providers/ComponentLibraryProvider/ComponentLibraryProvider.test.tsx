import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ComponentFolder,
  ComponentLibrary,
} from "@/types/componentLibrary";
import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";
import type { ComponentReferenceWithSpec } from "@/utils/componentStore";
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
import * as componentService from "@/services/componentService";
import * as componentStore from "@/utils/componentStore";
import * as getComponentName from "@/utils/getComponentName";
import * as localforage from "@/utils/localforage";

// Mock implementations
const mockFetchAndStoreComponentLibrary = vi.mocked(
  componentService.fetchAndStoreComponentLibrary,
);
const mockFetchUserComponents = vi.mocked(
  componentLibraryUtils.fetchUserComponents,
);
const mockFetchUsedComponents = vi.mocked(
  componentLibraryUtils.fetchUsedComponents,
);
const mockFetchFavoriteComponents = vi.mocked(
  componentLibraryUtils.fetchFavoriteComponents,
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
const mockUpdateComponentRefInList = vi.mocked(
  componentStore.updateComponentRefInList,
);
const mockLoadComponentAsRefFromText = vi.mocked(
  componentStore.loadComponentAsRefFromText,
);
const mockGetComponentByUrl = vi.mocked(localforage.getComponentByUrl);
const mockGetUserComponentByName = vi.mocked(
  localforage.getUserComponentByName,
);
const mockSaveComponent = vi.mocked(localforage.saveComponent);
const mockGetComponentName = vi.mocked(getComponentName.getComponentName);

describe("ComponentLibraryProvider - Component Management", () => {
  let queryClient: QueryClient;

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

  const createWrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ComponentSpecProvider spec={mockComponentSpec}>
        <ComponentLibraryProvider>{children}</ComponentLibraryProvider>
      </ComponentSpecProvider>
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    componentDuplicateDialogProps.handleImportComponent = undefined;

    // Setup default mock implementations
    mockFetchAndStoreComponentLibrary.mockResolvedValue(mockComponentLibrary);
    mockFetchUserComponents.mockResolvedValue(mockUserComponentsFolder);
    mockFetchUsedComponents.mockReturnValue({
      name: "Used Components",
      components: [],
      folders: [],
    });
    mockFetchFavoriteComponents.mockReturnValue({
      name: "Favorites",
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
    queryClient.clear();
  });

  describe("Adding Components", () => {
    it("should successfully add a component to the library", async () => {
      const newComponent: ComponentReference = {
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
      const newComponent: ComponentReference = {
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
        await result.current.addToComponentLibrary(newComponent);
      });

      // Should not call importComponent directly when there's a duplicate
      expect(mockImportComponent).not.toHaveBeenCalled();
      // Should check for existing user component
      expect(mockGetUserComponentByName).toHaveBeenCalledWith(
        "duplicate-component",
      );
    });

    it("should import renamed component as new without mutating the original", async () => {
      const newComponent: ComponentReference = {
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

      mockFlattenFolders.mockReturnValue([existingComponent]);
      mockGetUserComponentByName.mockResolvedValue(mockUserComponent);
      mockImportComponent.mockResolvedValue(undefined);

      const renamedSpec: ComponentSpec = {
        ...mockComponentSpec,
        name: "renamed-component",
      };

      const parsedComponent: ComponentReferenceWithSpec = {
        spec: renamedSpec,
        digest: "renamed-digest",
        text: "component: yaml",
      };

      mockLoadComponentAsRefFromText.mockResolvedValue(parsedComponent);

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.addToComponentLibrary(newComponent);
      });

      expect(componentDuplicateDialogProps.handleImportComponent).toBeDefined();

      await act(async () => {
        await componentDuplicateDialogProps.handleImportComponent?.(
          "component: yaml",
        );
      });

      expect(mockLoadComponentAsRefFromText).toHaveBeenCalledWith(
        "component: yaml",
      );
      expect(mockImportComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "renamed-component",
          spec: renamedSpec,
          text: "component: yaml",
          url: undefined,
        }),
      );
    });

    it("should add component when no duplicate exists", async () => {
      const newComponent: ComponentReference = {
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
        .mockImplementation(() => { });

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
        .mockImplementation(() => { });

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

    it("should correctly check if library contains component", async () => {
      const libraryComponent: ComponentReference = {
        name: "library-component",
        digest: "library-digest",
        spec: mockComponentSpec,
      };

      mockFlattenFolders.mockReturnValue([libraryComponent]);
      mockFilterToUniqueByDigest.mockReturnValue([libraryComponent]);

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const containsComponent =
        result.current.checkLibraryContainsComponent(libraryComponent);
      expect(containsComponent).toBe(true);
    });
  });

  describe("Component Favoriting", () => {
    it("should set component as favorite for user components", async () => {
      const userComponent: ComponentReference = {
        name: "user-component",
        digest: "user-digest",
        spec: mockComponentSpec,
        text: "user yaml content",
      };

      mockUpdateComponentRefInList.mockResolvedValue({
        componentRef: userComponent,
        name: "user-component",
        data: new ArrayBuffer(0),
        creationTime: new Date(),
        modificationTime: new Date(),
      } as any);

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setComponentFavorite(userComponent, true);
      });

      expect(mockUpdateComponentRefInList).toHaveBeenCalledWith(
        USER_COMPONENTS_LIST_NAME,
        expect.objectContaining({ favorited: true }),
        "user-component",
      );
    });

    it("should set component as favorite for standard components", async () => {
      const standardComponent: ComponentReference = {
        name: "standard-component",
        digest: "standard-digest",
        url: "https://example.com/standard.yaml",
        spec: mockComponentSpec,
      };

      const mockStoredComponent = {
        id: "stored-1",
        url: "https://example.com/standard.yaml",
        data: "stored yaml",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        favorited: false,
      };

      mockGetComponentByUrl.mockResolvedValue(mockStoredComponent);
      mockSaveComponent.mockResolvedValue(mockStoredComponent as any);

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setComponentFavorite(standardComponent, true);
      });

      expect(mockGetComponentByUrl).toHaveBeenCalledWith(
        "https://example.com/standard.yaml",
      );
      expect(mockSaveComponent).toHaveBeenCalledWith({
        ...mockStoredComponent,
        favorited: true,
      });
    });

    it("should check if component is favorited correctly", async () => {
      const favoritedComponent: ComponentReference = {
        name: "favorited-component",
        digest: "fav-digest",
        spec: mockComponentSpec,
        favorited: true,
      };

      mockFlattenFolders.mockReturnValue([favoritedComponent]);
      mockFilterToUniqueByDigest.mockReturnValue([favoritedComponent]);

      const { result } = renderHook(() => useComponentLibrary(), {
        wrapper: createWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const isFavorited = result.current.checkIfFavorited(favoritedComponent);
      expect(isFavorited).toBe(true);
    });
  });
});
