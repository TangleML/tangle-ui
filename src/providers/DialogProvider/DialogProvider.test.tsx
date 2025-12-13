import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDialog } from "../../hooks/useDialog";
import { DialogProvider } from "./DialogProvider";
import type { DialogProps } from "./types";

// Mock ResizeObserver for AnimatedHeight component
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

// Mock navigation functions
let mockSearchParams: Record<string, any> = {};

// Mock navigate that updates mockSearchParams to simulate real router behavior
const mockNavigate = vi.fn((options: { search: Record<string, any> }) => {
  mockSearchParams = options.search;
});

// Mock Tanstack Router
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockSearchParams,
}));

// Test dialog component
function TestDialog({
  close,
  cancel,
  title,
}: DialogProps<boolean> & { title: string }) {
  return (
    <div data-testid="test-dialog">
      <h1>{title}</h1>
      <button onClick={() => close(true)} data-testid="dialog-confirm">
        Confirm
      </button>
      <button onClick={cancel} data-testid="dialog-cancel">
        Cancel
      </button>
    </div>
  );
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <DialogProvider>{children}</DialogProvider>
);

describe("DialogProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
  });

  it("should render children and dialog stack", () => {
    render(
      <DialogProvider>
        <div>App Content</div>
      </DialogProvider>,
    );

    expect(screen.getByText("App Content")).toBeInTheDocument();
  });

  it("should update URL when dialog with routeKey opens", async () => {
    const { result } = renderHook(() => useDialog(), { wrapper });

    // Open dialog with routeKey
    act(() => {
      result.current.open({
        component: TestDialog,
        props: { title: "Test" },
        routeKey: "test-dialog",
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        search: expect.objectContaining({
          dialog: "test-dialog",
          dialogId: expect.any(String),
        }),
      });
    });
  });

  it("should not update URL when dialog without routeKey opens", async () => {
    const { result } = renderHook(() => useDialog(), { wrapper });

    // Open dialog without routeKey
    act(() => {
      result.current.open({
        component: TestDialog,
        props: { title: "Test" },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("test-dialog")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should clear URL params when dialog with routeKey closes", async () => {
    function TestComponent() {
      const dialog = useDialog();

      const handleOpen = () => {
        dialog.open({
          component: TestDialog,
          props: { title: "Test" },
          routeKey: "test-dialog",
        });
      };

      return <button onClick={handleOpen}>Open Dialog</button>;
    }

    render(
      <DialogProvider>
        <TestComponent />
      </DialogProvider>,
    );

    // Open dialog
    fireEvent.click(screen.getByText("Open Dialog"));
    await waitFor(() => {
      expect(screen.getByTestId("test-dialog")).toBeInTheDocument();
    });

    // Reset mock to track close navigation
    mockNavigate.mockClear();

    // Close dialog
    fireEvent.click(screen.getByTestId("dialog-confirm"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        search: {},
      });
    });
  });

  it("should handle browser back button", async () => {
    let dialogClosed = false;

    function TestComponent() {
      const dialog = useDialog();

      const handleOpen = async () => {
        try {
          await dialog.open({
            component: TestDialog,
            props: { title: "Test" },
            routeKey: "test-dialog",
          });
        } catch {
          dialogClosed = true;
        }
      };

      return <button onClick={handleOpen}>Open Dialog</button>;
    }

    const { rerender } = render(
      <DialogProvider>
        <TestComponent />
      </DialogProvider>,
    );

    // Open dialog
    fireEvent.click(screen.getByText("Open Dialog"));

    await waitFor(() => {
      expect(screen.getByTestId("test-dialog")).toBeInTheDocument();
    });

    // Simulate browser back by clearing search params and re-rendering
    mockSearchParams = {};

    rerender(
      <DialogProvider>
        <TestComponent />
      </DialogProvider>,
    );

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByTestId("test-dialog")).not.toBeInTheDocument();
      expect(dialogClosed).toBe(true);
    });
  });

  it("should handle closeOnEsc option", async () => {
    let dialogResult: string | undefined;

    function TestComponent() {
      const dialog = useDialog();

      const handleOpen = async () => {
        try {
          await dialog.open({
            component: TestDialog,
            props: { title: "Test" },
            closeOnEsc: false,
          });
          dialogResult = "closed";
        } catch {
          dialogResult = "cancelled";
        }
      };

      return <button onClick={handleOpen}>Open Dialog</button>;
    }

    render(
      <DialogProvider>
        <TestComponent />
      </DialogProvider>,
    );

    // Open dialog
    fireEvent.click(screen.getByText("Open Dialog"));
    await waitFor(() => {
      expect(screen.getByTestId("test-dialog")).toBeInTheDocument();
    });

    // Press ESC
    fireEvent.keyDown(document.activeElement || document.body, {
      key: "Escape",
    });

    // Dialog should still be open because closeOnEsc is false
    await waitFor(() => {
      expect(screen.getByTestId("test-dialog")).toBeInTheDocument();
      expect(dialogResult).toBeUndefined();
    });
  });

  it("should handle dialog size prop", async () => {
    const { result } = renderHook(() => useDialog(), { wrapper });

    // Open dialog with size
    act(() => {
      result.current.open({
        component: TestDialog,
        props: { title: "Test" },
        size: "xl",
      });
    });

    await waitFor(() => {
      const dialogContent = screen
        .getByTestId("test-dialog")
        .closest("[data-slot='dialog-content']");
      expect(dialogContent).toHaveClass("sm:max-w-4xl");
    });
  });

  it("should maintain dialog stack order (only topmost dialog is rendered)", async () => {
    const { result } = renderHook(() => useDialog(), { wrapper });

    // Open multiple dialogs
    act(() => {
      result.current.open({
        component: TestDialog,
        props: { title: "Dialog 1" },
      });
    });

    act(() => {
      result.current.open({
        component: TestDialog,
        props: { title: "Dialog 2" },
      });
    });

    act(() => {
      result.current.open({
        component: TestDialog,
        props: { title: "Dialog 3" },
      });
    });

    // Only the topmost dialog (Dialog 3) should be rendered
    await waitFor(() => {
      const dialogs = screen.getAllByTestId("test-dialog");
      expect(dialogs).toHaveLength(1);
      expect(screen.getByText("Dialog 3")).toBeInTheDocument();
    });

    // Other dialogs should not be in the DOM
    expect(screen.queryByText("Dialog 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Dialog 2")).not.toBeInTheDocument();
  });

  it("should only close top dialog when nested dialogs with routeKeys are used", async () => {
    // Test component that opens nested dialogs
    function NestedDialogOpener({
      close,
      title,
    }: DialogProps<boolean> & { title: string }) {
      const dialog = useDialog();

      const openNestedDialog = () => {
        dialog.open({
          component: TestDialog,
          props: { title: "Dialog B (nested)" },
          routeKey: "dialog-b",
        });
      };

      return (
        <div data-testid={`dialog-${title}`}>
          <h1>{title}</h1>
          <button onClick={openNestedDialog} data-testid="open-nested">
            Open Nested Dialog
          </button>
          <button onClick={() => close(true)} data-testid="close-parent">
            Close Parent
          </button>
        </div>
      );
    }

    function TestComponent() {
      const dialog = useDialog();

      const handleOpenDialogA = () => {
        dialog.open({
          component: NestedDialogOpener,
          props: { title: "Dialog A" },
          routeKey: "dialog-a",
        });
      };

      return <button onClick={handleOpenDialogA}>Open Dialog A</button>;
    }

    render(
      <DialogProvider disableRouterSync>
        <TestComponent />
      </DialogProvider>,
    );

    // Step 1: Open Dialog A
    fireEvent.click(screen.getByText("Open Dialog A"));
    await waitFor(() => {
      expect(screen.getByTestId("dialog-Dialog A")).toBeInTheDocument();
    });

    // Step 2: Open Dialog B from inside Dialog A
    fireEvent.click(screen.getByTestId("open-nested"));
    await waitFor(() => {
      // Only the top dialog (Dialog B) is rendered - Dialog A is in the stack but not visible
      expect(screen.getByTestId("test-dialog")).toBeInTheDocument();
      expect(screen.getByText("Dialog B (nested)")).toBeInTheDocument();
    });

    // Dialog A is no longer visible (only topmost dialog is rendered)
    expect(screen.queryByTestId("dialog-Dialog A")).not.toBeInTheDocument();

    // Step 3: Confirm Dialog B (the nested one) - use the confirm button inside test-dialog
    const dialogB = screen.getByTestId("test-dialog");
    const confirmButton = dialogB.querySelector(
      '[data-testid="dialog-confirm"]',
    );
    expect(confirmButton).not.toBeNull();
    fireEvent.click(confirmButton!);

    // Step 4: Only Dialog B should be closed, Dialog A should become visible again
    await waitFor(() => {
      // Dialog B should be gone
      expect(screen.queryByText("Dialog B (nested)")).not.toBeInTheDocument();
      // Dialog A should now be visible (it's now the top of the stack)
      expect(screen.getByTestId("dialog-Dialog A")).toBeInTheDocument();
    });
  });

  it("should restore parent dialog URL when closing nested dialog with routeKey", async () => {
    function NestedDialogOpener({
      close,
      title,
    }: DialogProps<boolean> & { title: string }) {
      const dialog = useDialog();

      const openNestedDialog = () => {
        dialog.open({
          component: TestDialog,
          props: { title: "Dialog B" },
          routeKey: "dialog-b",
        });
      };

      return (
        <div data-testid={`dialog-${title}`}>
          <h1>{title}</h1>
          <button onClick={openNestedDialog} data-testid="open-nested">
            Open Nested
          </button>
          <button onClick={() => close(true)} data-testid="close-parent">
            Close
          </button>
        </div>
      );
    }

    function TestComponent() {
      const dialog = useDialog();

      const handleOpenDialogA = () => {
        dialog.open({
          component: NestedDialogOpener,
          props: { title: "Dialog A" },
          routeKey: "dialog-a",
        });
      };

      return <button onClick={handleOpenDialogA}>Open Dialog A</button>;
    }

    render(
      <DialogProvider disableRouterSync>
        <TestComponent />
      </DialogProvider>,
    );

    // Open Dialog A
    fireEvent.click(screen.getByText("Open Dialog A"));
    await waitFor(() => {
      expect(screen.getByTestId("dialog-Dialog A")).toBeInTheDocument();
    });

    // Capture the dialogId for Dialog A
    const dialogACall = mockNavigate.mock.calls.find(
      (call) => call[0].search.dialog === "dialog-a",
    );
    const dialogAId = dialogACall?.[0].search.dialogId;
    expect(dialogAId).toBeTruthy();

    // Open Dialog B
    fireEvent.click(screen.getByTestId("open-nested"));
    await waitFor(() => {
      expect(screen.getByText("Dialog B")).toBeInTheDocument();
    });

    // Reset mock to check close navigation
    mockNavigate.mockClear();

    // Close Dialog B
    fireEvent.click(screen.getByTestId("dialog-confirm"));

    // URL should be restored to Dialog A's info
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        search: expect.objectContaining({
          dialog: "dialog-a",
          dialogId: dialogAId,
        }),
      });
    });
  });
});
