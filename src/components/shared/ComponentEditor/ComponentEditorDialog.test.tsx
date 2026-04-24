import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import useToastNotification from "@/hooks/useToastNotification";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";
import { hydrateComponentReference } from "@/services/componentService";
import { saveComponent } from "@/utils/localforage";

import { ComponentEditorDialog } from "./ComponentEditorDialog";

// Mock only what's necessary
vi.mock("@/hooks/useToastNotification", () => ({
  default: vi.fn(),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: vi.fn().mockReturnValue({ track: vi.fn() }),
}));

vi.mock("@/providers/ComponentLibraryProvider", () => ({
  useComponentLibrary: vi.fn(),
}));

vi.mock("@/services/componentService", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    hydrateComponentReference: vi.fn(),
  };
});

vi.mock("@/utils/localforage", () => ({
  saveComponent: vi.fn(),
}));

// Mock the Python generator to avoid Pyodide loading in tests
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
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const TestWrapper = ({ children }: { children: ReactNode }) => {
    return (
      <QueryClientProvider client={queryClient}>
        <ReactFlowProvider>
          <ComponentSpecProvider>
            <ContextPanelProvider>{children}</ContextPanelProvider>
          </ComponentSpecProvider>
        </ReactFlowProvider>
      </QueryClientProvider>
    );
  };

  const renderWithProviders = (component: React.ReactElement) => {
    return render(component, { wrapper: TestWrapper });
  };

  // Set up default mocks
  const mockToast = vi.fn();
  const mockAddToComponentLibrary = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToastNotification).mockReturnValue(mockToast);
    vi.mocked(useComponentLibrary).mockReturnValue({
      addToComponentLibrary: mockAddToComponentLibrary,
    } as any);
    vi.mocked(hydrateComponentReference).mockResolvedValue(null);
    vi.mocked(saveComponent).mockImplementation(async (component) => component);
  });

  test("calls onClose when close button is clicked", async () => {
    const onCloseMock = vi.fn();

    renderWithProviders(<ComponentEditorDialog onClose={onCloseMock} />);

    // Wait for the component to render (suspense boundary)
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "New Component" }),
      ).toBeInTheDocument();
    });

    // Find all buttons and identify the close button by its variant and icon
    const buttons = screen.getAllByRole("button");

    // The close button should be the last button (after the Save button)
    // and should have variant="ghost" and size="icon"
    const closeButton = buttons[buttons.length - 1];

    expect(closeButton).toBeDefined();

    // Click the close button
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

      // Should not show template name for empty template
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

      // Should show the template name in subtitle
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

      // Should show the template name in subtitle
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

      // Should show the template name in subtitle
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

      // Should show the template name in subtitle
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
          implementation: { container: { image: "test" } },
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

      vi.mocked(hydrateComponentReference).mockResolvedValueOnce(mockComponent);

      renderWithProviders(
        <ComponentEditorDialog text="name: test-component" onClose={vi.fn()} />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("python-editor")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("yaml-editor-preview"),
      ).not.toBeInTheDocument();

      // Verify we have both Python editor and preview sections
      expect(screen.getByTestId("python-editor-preview")).toBeInTheDocument();
    });

    test("renders YamlComponentEditor when component has no python annotations", async () => {
      const mockComponent: any = {
        spec: {
          implementation: { container: { image: "test" } },
          metadata: {
            annotations: {
              // No python_original_code annotation
              author: "test-author",
            },
          },
        },
        name: "test-component",
        digest: "xyz789",
        text: "name: test-component\ninputs:\n- {name: Input}",
      };

      vi.mocked(hydrateComponentReference).mockResolvedValueOnce(mockComponent);

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
          implementation: { container: { image: "test" } },
          metadata: { annotations: {} },
        },
        name: "test-component",
        digest: "abc123",
        text: "name: test-component",
      };

      vi.mocked(hydrateComponentReference).mockResolvedValue(
        mockHydratedComponent,
      );

      renderWithProviders(
        <ComponentEditorDialog
          text="name: test-component"
          onClose={onCloseMock}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Save/i }),
        ).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Verify saveComponent was called
        expect(saveComponent).toHaveBeenCalled();

        // Verify addToComponentLibrary was called
        expect(mockAddToComponentLibrary).toHaveBeenCalledWith(
          mockHydratedComponent,
        );

        // Verify success toast notification was shown
        expect(mockToast).toHaveBeenCalledWith(
          `Component ${mockHydratedComponent.name} imported successfully`,
          "success",
        );

        // Verify onClose was called after successful save
        expect(onCloseMock).toHaveBeenCalledTimes(1);
      });
    });
  });
});
