import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import useToastNotification from "@/hooks/useToastNotification";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { saveComponent } from "@/utils/localforage";

import { ComponentEditorDialog } from "./ComponentEditorDialog";

// Use vi.hoisted to create mocks that can be referenced in vi.mock
const { mockHydrateComponentReference } = vi.hoisted(() => ({
  mockHydrateComponentReference: vi.fn(),
}));

// Mock the entire module
vi.mock("@/services/componentService", () => ({
  hydrateComponentReference: mockHydrateComponentReference,
  fetchAndStoreComponentLibrary: vi.fn(),
  fetchAndStoreComponent: vi.fn(),
  fetchAndStoreComponentByUrl: vi.fn(),
  getComponentText: vi.fn(),
  fetchComponentTextFromUrl: vi.fn(),
  parseComponentData: vi.fn(),
  getExistingAndNewUserComponent: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: vi.fn(),
}));

vi.mock("@/providers/ComponentLibraryProvider", () => ({
  useComponentLibrary: vi.fn(),
}));

vi.mock("@/utils/localforage", () => ({
  saveComponent: vi.fn(),
}));

vi.mock("./generators/python", () => ({
  usePythonYamlGenerator: () => {
    return vi.fn().mockResolvedValue(`name: Generated Component
inputs:
- {name: Input}
outputs:
- {name: Output}`);
  },
}));

describe("<ComponentEditorDialog />", () => {
  let queryClient: QueryClient;

  const TestWrapper = ({ children }: { children: ReactNode }) => {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  const renderWithProviders = (component: React.ReactElement) => {
    return render(component, { wrapper: TestWrapper });
  };

  const mockToast = vi.fn();
  const mockAddToComponentLibrary = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.mocked(useToastNotification).mockReturnValue(mockToast);
    vi.mocked(useComponentLibrary).mockReturnValue({
      addToComponentLibrary: mockAddToComponentLibrary,
    } as any);

    // Default: return null for components without Python code
    mockHydrateComponentReference.mockResolvedValue(null);
    vi.mocked(saveComponent).mockImplementation(async (component) => component);
  });

  afterEach(() => {
    queryClient.clear();
  });

  test("calls onClose when close button is clicked", async () => {
    const onCloseMock = vi.fn();

    renderWithProviders(<ComponentEditorDialog onClose={onCloseMock} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "New Component" }),
      ).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button");
    const closeButton = buttons[buttons.length - 1];

    fireEvent.click(closeButton);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  describe("template loading", () => {
    test("loads empty template correctly", async () => {
      renderWithProviders(
        <ComponentEditorDialog templateName="empty" onClose={vi.fn()} />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "New Component" }),
        ).toBeInTheDocument();
      });

      expect(screen.queryByText("(empty template)")).not.toBeInTheDocument();
    });

    test("loads python template from file", async () => {
      renderWithProviders(
        <ComponentEditorDialog templateName="python" onClose={vi.fn()} />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "New Component" }),
        ).toBeInTheDocument();
      });

      expect(screen.getByText("(python template)")).toBeInTheDocument();
    });

    test("loads bash template from file", async () => {
      renderWithProviders(
        <ComponentEditorDialog templateName="bash" onClose={vi.fn()} />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "New Component" }),
        ).toBeInTheDocument();
      });

      expect(screen.getByText("(bash template)")).toBeInTheDocument();
    });

    test("loads javascript template from file", async () => {
      renderWithProviders(
        <ComponentEditorDialog templateName="javascript" onClose={vi.fn()} />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "New Component" }),
        ).toBeInTheDocument();
      });

      expect(screen.getByText("(javascript template)")).toBeInTheDocument();
    });

    test("loads ruby template from file", async () => {
      renderWithProviders(
        <ComponentEditorDialog templateName="ruby" onClose={vi.fn()} />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "New Component" }),
        ).toBeInTheDocument();
      });

      expect(screen.getByText("(ruby template)")).toBeInTheDocument();
    });
  });

  describe("editor selection", () => {
    test("renders YamlComponentEditor for non-python templates", async () => {
      renderWithProviders(
        <ComponentEditorDialog templateName="bash" onClose={vi.fn()} />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("yaml-editor-preview")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("python-editor")).not.toBeInTheDocument();
    });

    test("renders PythonComponentEditor when templateName is 'python'", async () => {
      renderWithProviders(
        <ComponentEditorDialog templateName="python" onClose={vi.fn()} />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("python-editor")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("yaml-editor-preview"),
      ).not.toBeInTheDocument();
    });

    test("renders PythonComponentEditor for component with python_original_code annotation", async () => {
      const mockComponent: any = {
        spec: {
          name: "test-component",
          implementation: {
            container: {
              image: "python:3.12",
            },
          },
          metadata: {
            annotations: {
              python_original_code: "def my_function():\n    return 'hello'",
            },
          },
        },
        name: "test-component",
        digest: "abc123",
        text: "name: test-component",
      };

      mockHydrateComponentReference.mockResolvedValue(mockComponent);

      renderWithProviders(
        <ComponentEditorDialog text="name: test-component" onClose={vi.fn()} />,
      );

      await waitFor(
        () => {
          expect(screen.getByTestId("python-editor")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      expect(
        screen.queryByTestId("yaml-editor-preview"),
      ).not.toBeInTheDocument();

      expect(screen.getByTestId("python-editor-preview")).toBeInTheDocument();
    });

    test("renders YamlComponentEditor when component has no python annotations", async () => {
      const mockComponent: any = {
        spec: {
          name: "test-component",
          implementation: { container: { image: "test" } },
          metadata: {
            annotations: {
              author: "test-author",
            },
          },
        },
        name: "test-component",
        digest: "xyz789",
        text: "name: test-component\ninputs:\n- {name: Input}",
      };

      mockHydrateComponentReference.mockResolvedValue(mockComponent);

      renderWithProviders(
        <ComponentEditorDialog
          text="name: test-component\ninputs:\n- {name: Input}"
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("yaml-editor-preview")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("python-editor")).not.toBeInTheDocument();
    });
  });

  describe("save functionality", () => {
    test("successfully saves a valid component", async () => {
      const onCloseMock = vi.fn();
      const mockHydratedComponent = {
        spec: {
          name: "test-component",
          implementation: { container: { image: "test" } },
          metadata: { annotations: {} },
        },
        name: "test-component",
        digest: "abc123",
        text: "name: test-component",
      };

      mockHydrateComponentReference.mockResolvedValue(mockHydratedComponent);

      renderWithProviders(
        <ComponentEditorDialog
          text="name: test-component"
          onClose={onCloseMock}
        />,
      );

      // Wait for component to fully load
      await waitFor(
        () => {
          expect(screen.getByTestId("yaml-editor-preview")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      // Wait for Save button to be ready
      await waitFor(
        () => {
          const saveButton = screen.getByRole("button", { name: /Save/i });
          expect(saveButton).not.toBeDisabled();
        },
        { timeout: 5000 },
      );

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      // Wait for save operations to complete
      await waitFor(
        () => {
          expect(saveComponent).toHaveBeenCalled();
        },
        { timeout: 5000 },
      );

      expect(mockAddToComponentLibrary).toHaveBeenCalledWith(
        mockHydratedComponent,
      );

      expect(mockToast).toHaveBeenCalledWith(
        `Component ${mockHydratedComponent.name} imported successfully`,
        "success",
      );

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });
});
