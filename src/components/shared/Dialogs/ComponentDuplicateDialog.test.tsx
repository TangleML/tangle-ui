import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ComponentFolder } from "@/types/componentLibrary";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import type { UserComponent } from "@/utils/localforage";

import ComponentDuplicateDialog from "./ComponentDuplicateDialog";

// Mock only what's necessary - file operations and digest generation
vi.mock("@/utils/componentStore", async (importOriginal) => ({
  ...(await importOriginal()),
  deleteComponentFileFromList: vi.fn().mockResolvedValue(undefined),
}));

// Import mocked functions
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import {
  deleteComponentFileFromList,
  generateDigest,
} from "@/utils/componentStore";

// Create a reusable test wrapper for ComponentLibraryProvider
const createMockComponentLibraryContext = (
  userComponents: UserComponent[] = [],
) => {
  const userComponentsFolder: ComponentFolder = {
    name: "User Components",
    components: userComponents,
    isUserFolder: true,
  };

  return {
    componentLibrary: undefined,
    userComponentsFolder,
    usedComponentsFolder: { name: "Used", components: [] },
    favoritesFolder: { name: "Favorites", components: [] },
    isLoading: false,
    error: null,
    existingComponentLibraries: undefined,
    searchResult: null,
    searchComponentLibrary: vi.fn(),
    addToComponentLibrary: vi.fn(),
    removeFromComponentLibrary: vi.fn(),
    setComponentFavorite: vi.fn(),
    checkIfUserComponent: vi.fn().mockReturnValue(false),
    checkLibraryContainsComponent: vi.fn().mockReturnValue(false),
    getComponentLibrary: vi.fn(),
  };
};

// Mock the ComponentLibraryProvider
vi.mock("@/providers/ComponentLibraryProvider", () => ({
  useComponentLibrary: vi.fn(),
}));

describe("ComponentDuplicateDialog", () => {
  // Test data
  const mockExistingComponent: UserComponent = {
    name: "ExistingComponent",
    componentRef: {
      name: "ExistingComponent",
      digest: "existing-digest-123",
    },
    data: new ArrayBuffer(0),
    creationTime: new Date("2024-01-01"),
    modificationTime: new Date("2024-01-02"),
  };

  const mockNewComponent: HydratedComponentReference = {
    name: "NewComponent",
    digest: "new-digest-456",
    text: `name: NewComponent
description: A new component
inputs: []
outputs: []
implementation:
  container:
    image: test-image`,
    spec: {
      name: "NewComponent",
      description: "A new component",
      inputs: [],
      outputs: [],
      implementation: {
        container: {
          image: "test-image",
        },
      },
    },
  };

  const mockHandleImportComponent = vi.fn().mockResolvedValue(undefined);
  const mockSetClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useComponentLibrary).mockReturnValue(
      createMockComponentLibraryContext([mockExistingComponent]),
    );
  });

  test("should close dialog when Cancel button is clicked", async () => {
    render(
      <ComponentDuplicateDialog
        existingComponent={mockExistingComponent}
        newComponent={mockNewComponent}
        setClose={mockSetClose}
        handleImportComponent={mockHandleImportComponent}
      />,
    );

    // Verify dialog is open
    expect(
      screen.getByTestId("component-duplicate-dialog-title"),
    ).toBeInTheDocument();
    expect(screen.getByText("Component already exists")).toBeInTheDocument();

    // Click Cancel button
    const cancelButton = screen.getByTestId(
      "duplicate-component-cancel-button",
    );

    await act(async () => {
      fireEvent.click(cancelButton);
    });

    // Verify setClose was called
    expect(mockSetClose).toHaveBeenCalledOnce();
    expect(mockHandleImportComponent).not.toHaveBeenCalled();
  });

  test("should replace existing component when Replace existing button is clicked", async () => {
    render(
      <ComponentDuplicateDialog
        existingComponent={mockExistingComponent}
        newComponent={mockNewComponent}
        setClose={mockSetClose}
        handleImportComponent={mockHandleImportComponent}
      />,
    );

    // Verify dialog is open with correct existing component info
    const existingNameInput = screen.getAllByRole("textbox")[0];
    expect(existingNameInput).toHaveValue("ExistingComponent");
    expect(existingNameInput).toHaveAttribute("readonly");

    // Click Replace existing button
    const replaceButton = screen.getByTestId(
      "duplicate-component-replace-existing-button",
    );

    await act(async () => {
      await fireEvent.click(replaceButton);
    });

    await waitFor(() => {
      // Verify deleteComponentFileFromList was called with correct parameters
      expect(deleteComponentFileFromList).toHaveBeenCalledWith(
        "user_components",
        "ExistingComponent",
      );

      // Verify handleImportComponent was called with the original text
      expect(mockHandleImportComponent).toHaveBeenCalledWith(
        mockNewComponent.text,
      );

      // Verify setClose was called
      expect(mockSetClose).toHaveBeenCalledOnce();
    });
  });

  test("should import as new component when Import as new button is clicked", async () => {
    render(
      <ComponentDuplicateDialog
        existingComponent={mockExistingComponent}
        newComponent={mockNewComponent}
        setClose={mockSetClose}
        handleImportComponent={mockHandleImportComponent}
      />,
    );

    // Find the new component name input (based on the rendering order)
    const nameInputs = screen.getAllByRole("textbox");
    const newNameInput = nameInputs[2]; // Third input is the editable new component name

    // Verify initial state
    expect(newNameInput).toHaveValue("NewComponent");

    // Change the name to something different
    await act(async () => {
      await fireEvent.change(newNameInput, {
        target: { value: "RenamedComponent" },
      });
      const importButton = screen.getByText("Import as new");
      fireEvent.click(importButton);
    });

    await waitFor(() => {
      // Verify handleImportComponent was called with renamed text
      expect(mockHandleImportComponent).toHaveBeenCalledWith(
        expect.stringContaining("name: RenamedComponent"),
      );

      // Verify deleteComponentFileFromList was NOT called
      expect(deleteComponentFileFromList).not.toHaveBeenCalled();

      // Verify setClose was called
      expect(mockSetClose).toHaveBeenCalledOnce();
    });
  });

  test("should disable Import as new button when name is the same as existing", async () => {
    render(
      <ComponentDuplicateDialog
        existingComponent={mockExistingComponent}
        newComponent={mockNewComponent}
        setClose={mockSetClose}
        handleImportComponent={mockHandleImportComponent}
      />,
    );

    const importButton = screen.getByText("Import as new");
    const nameInputs = screen.getAllByRole("textbox");
    const newNameInput = nameInputs[2]; // Third input is the editable new component name

    // Initially, the name should be "NewComponent" and button should be enabled
    expect(newNameInput).toHaveValue("NewComponent");
    expect(importButton).toBeEnabled();

    // Change name to be same as existing component - should disable button
    await act(async () => {
      fireEvent.change(newNameInput, {
        target: { value: "ExistingComponent" },
      });
    });

    expect(importButton).toBeDisabled();
  });

  test("should not render dialog when required props are missing", () => {
    // Test with missing newComponent
    const { container: container1 } = render(
      <ComponentDuplicateDialog
        existingComponent={mockExistingComponent}
        newComponent={null}
        setClose={mockSetClose}
        handleImportComponent={mockHandleImportComponent}
      />,
    );
    expect(container1.querySelector("[role='dialog']")).not.toBeInTheDocument();

    // Test with missing existingComponent
    const { container: container2 } = render(
      <ComponentDuplicateDialog
        existingComponent={undefined}
        newComponent={mockNewComponent}
        setClose={mockSetClose}
        handleImportComponent={mockHandleImportComponent}
      />,
    );
    expect(container2.querySelector("[role='dialog']")).not.toBeInTheDocument();
  });

  test("should display correct component information in the dialog", async () => {
    const digest = await generateDigest(mockNewComponent.text);

    render(
      <ComponentDuplicateDialog
        existingComponent={mockExistingComponent}
        newComponent={mockNewComponent}
        setClose={mockSetClose}
        handleImportComponent={mockHandleImportComponent}
      />,
    );

    await waitFor(() => {
      // Check dialog title and descriptions
      expect(screen.getByText("Component already exists")).toBeInTheDocument();
      expect(
        screen.getByText(
          /The component you are trying to import already exists/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Note: "Replace existing" will use the existing name/),
      ).toBeInTheDocument();

      // Check existing component section
      expect(screen.getByText("Existing Component")).toBeInTheDocument();
      const textboxes = screen.getAllByRole("textbox");

      // Existing component name (first textbox)
      expect(textboxes[0]).toHaveValue("ExistingComponent");
      expect(textboxes[0]).toHaveAttribute("readonly");
      expect(textboxes[0]).toHaveClass("border-blue-200", "bg-blue-100/50");

      // Existing component digest (second textbox)
      expect(textboxes[1]).toHaveValue("existing-digest-123");
      expect(textboxes[1]).toHaveAttribute("readonly");
      expect(textboxes[1]).toHaveClass("border-blue-200", "bg-blue-100/50");

      // Check new component section
      expect(screen.getByText("New Component")).toBeInTheDocument();

      // New component name (third textbox) - should be editable
      expect(textboxes[2]).toHaveValue("NewComponent");
      expect(textboxes[2]).not.toHaveAttribute("readonly");
      expect(textboxes[2]).toHaveFocus(); // Has autoFocus

      // New component digest (fourth textbox)

      expect(textboxes[3]).toHaveValue(digest);
      expect(textboxes[3]).toHaveAttribute("readonly");
    });
  });

  describe("Validation", () => {
    test("should show validation error when new name is empty", async () => {
      render(
        <ComponentDuplicateDialog
          existingComponent={mockExistingComponent}
          newComponent={mockNewComponent}
          setClose={mockSetClose}
          handleImportComponent={mockHandleImportComponent}
        />,
      );

      // Find new name textbox (third textbox)
      const textboxes = screen.getAllByRole("textbox");
      const newNameInput = textboxes[2];

      // Clear the input
      await act(async () => {
        fireEvent.change(newNameInput, { target: { value: "" } });
      });

      // Should display name empty error
      expect(screen.getByText("Name cannot be empty")).toBeInTheDocument();

      // Import as new should be disabled
      expect(
        screen.getByRole("button", { name: /Import as new/i }),
      ).toBeDisabled();
    });

    test("should not show validation error when new name is the same as existing component", async () => {
      render(
        <ComponentDuplicateDialog
          existingComponent={mockExistingComponent}
          newComponent={mockNewComponent}
          setClose={mockSetClose}
          handleImportComponent={mockHandleImportComponent}
        />,
      );

      // Find new name textbox (third textbox)
      const textboxes = screen.getAllByRole("textbox");
      const newNameInput = textboxes[2];

      // Set name to existing component name (should be the default already)
      await act(async () => {
        fireEvent.change(newNameInput, {
          target: { value: "ExistingComponent" },
        });
      });

      // Should not display a validation error (validation allows renaming to current)
      expect(screen.queryByText("Name already exists")).not.toBeInTheDocument();

      // Import as new should be disabled (button logic)
      expect(
        screen.getByRole("button", { name: /Import as new/i }),
      ).toBeDisabled();
    });

    test("should show validation error when new name matches another user's component", async () => {
      vi.mocked(useComponentLibrary).mockReturnValue(
        createMockComponentLibraryContext([
          mockExistingComponent,
          {
            name: "ConflictName",
            componentRef: {
              name: "ConflictName",
              digest: "conflict-digest-789",
            },
            data: new ArrayBuffer(0),
            creationTime: new Date(),
            modificationTime: new Date(),
          },
        ]),
      );

      // Use the wrapper with multiple components
      render(
        <ComponentDuplicateDialog
          existingComponent={mockExistingComponent}
          newComponent={mockNewComponent}
          setClose={mockSetClose}
          handleImportComponent={mockHandleImportComponent}
        />,
      );

      const textboxes = screen.getAllByRole("textbox");
      const newNameInput = textboxes[2];

      // Change name to conflicting name
      await act(async () => {
        fireEvent.change(newNameInput, { target: { value: "ConflictName" } });
      });

      expect(screen.getByText("Name already exists")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Import as new/i }),
      ).toBeDisabled();
    });
  });
});
