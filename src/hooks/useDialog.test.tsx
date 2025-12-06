import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock ResizeObserver for tests (not available in jsdom)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  global.ResizeObserver = ResizeObserverMock;
});

import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import type { DialogProps } from "@/providers/DialogProvider/types";

import { useDialog } from "./useDialog";

// Mock Tanstack Router (needed since we're not in a router context)
let mockSearchParams: Record<string, any> = {};
const mockNavigate = vi.fn((options: any) => {
  if (options?.search) {
    mockSearchParams = { ...options.search };
  }
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({ ...mockSearchParams }), // Return a copy to trigger updates
}));

// Test dialog component with proper types
interface TestDialogProps extends DialogProps<string> {
  message: string;
}

function TestDialog({ close, cancel, message }: TestDialogProps) {
  const [input, setInput] = useState("");

  return (
    <>
      <DialogHeader>
        <DialogTitle>{message}</DialogTitle>
        <DialogDescription>Test dialog for unit testing</DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          data-testid="dialog-input"
          className="w-full border rounded px-2 py-1"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={cancel}
          data-testid="dialog-cancel"
          className="px-3 py-1 border rounded"
        >
          Cancel
        </button>
        <button
          onClick={() => close(input)}
          data-testid="dialog-confirm"
          className="px-3 py-1 border rounded bg-blue-500 text-white"
        >
          Confirm
        </button>
      </div>
    </>
  );
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <DialogProvider disableRouterSync>{children}</DialogProvider>
);

describe("useDialog", () => {
  beforeEach(() => {
    // Reset mock search params before each test
    mockSearchParams = {};
    mockNavigate.mockClear();
  });

  it("should throw error when used outside DialogProvider", () => {
    // Suppress console error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useDialog());
    }).toThrow("useDialog must be used within DialogProvider");

    consoleSpy.mockRestore();
  });

  it("should provide dialog methods when used inside DialogProvider", () => {
    const { result } = renderHook(() => useDialog(), { wrapper });

    expect(result.current).toHaveProperty("open");
    expect(result.current).toHaveProperty("close");
    expect(result.current).toHaveProperty("closeAll");
    expect(typeof result.current.open).toBe("function");
  });

  it("should open and close a dialog with result", async () => {
    let dialogResult: string | undefined;

    function TestComponent() {
      const dialog = useDialog();

      const handleOpen = async () => {
        try {
          dialogResult = await dialog.open<string>({
            component: TestDialog as any,
            props: { message: "Test Dialog" },
          });
        } catch {
          dialogResult = "cancelled";
        }
      };

      return <button onClick={handleOpen}>Open Dialog</button>;
    }

    render(
      <DialogProvider disableRouterSync>
        <TestComponent />
      </DialogProvider>,
    );

    // Open dialog
    fireEvent.click(screen.getByText("Open Dialog"));
    await waitFor(() => {
      expect(screen.getByText("Test Dialog")).toBeInTheDocument();
    });

    // Type in input
    const input = screen.getByTestId("dialog-input");
    fireEvent.change(input, { target: { value: "test result" } });

    // Confirm dialog
    fireEvent.click(screen.getByTestId("dialog-confirm"));

    // Check result
    await waitFor(() => {
      expect(dialogResult).toBe("test result");
      expect(screen.queryByText("Test Dialog")).not.toBeInTheDocument();
    });
  });

  it("should reject promise when dialog is cancelled", async () => {
    let dialogResult: string | undefined;

    function TestComponent() {
      const dialog = useDialog();

      const handleOpen = async () => {
        try {
          dialogResult = await dialog.open<string>({
            component: TestDialog as any,
            props: { message: "Test Dialog" },
          });
        } catch {
          dialogResult = "cancelled";
        }
      };

      return <button onClick={handleOpen}>Open Dialog</button>;
    }

    render(
      <DialogProvider disableRouterSync>
        <TestComponent />
      </DialogProvider>,
    );

    // Open dialog
    fireEvent.click(screen.getByText("Open Dialog"));
    await waitFor(() => {
      expect(screen.getByText("Test Dialog")).toBeInTheDocument();
    });

    // Cancel dialog
    fireEvent.click(screen.getByTestId("dialog-cancel"));

    // Check result
    await waitFor(() => {
      expect(dialogResult).toBe("cancelled");
      expect(screen.queryByText("Test Dialog")).not.toBeInTheDocument();
    });
  });

  it("should handle multiple dialogs in stack", async () => {
    const results: string[] = [];

    function TestComponent() {
      const dialog = useDialog();

      const handleOpenFirst = async () => {
        const result = await dialog.open<string>({
          component: TestDialog as any,
          props: { message: "First Dialog" },
        });
        results.push(result);
      };

      const handleOpenSecond = async () => {
        const result = await dialog.open<string>({
          component: TestDialog as any,
          props: { message: "Second Dialog" },
        });
        results.push(result);
      };

      return (
        <>
          <button onClick={handleOpenFirst}>Open First</button>
          <button onClick={handleOpenSecond}>Open Second</button>
        </>
      );
    }

    render(
      <DialogProvider disableRouterSync>
        <TestComponent />
      </DialogProvider>,
    );

    // Open first dialog
    fireEvent.click(screen.getByText("Open First"));
    await waitFor(() => {
      expect(screen.getByText("First Dialog")).toBeInTheDocument();
    });

    // Open second dialog (stacked on top - replaces first dialog content)
    fireEvent.click(screen.getByText("Open Second"));
    await waitFor(() => {
      expect(screen.getByText("Second Dialog")).toBeInTheDocument();
    });

    // Only the top dialog (Second Dialog) should be visible in the DOM
    // The dialog system shows one dialog at a time within a single dialog shell
    expect(screen.queryByText("First Dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Second Dialog")).toBeInTheDocument();

    // Back button should be visible when there are multiple dialogs in stack
    expect(
      screen.getByLabelText("Go back to previous dialog"),
    ).toBeInTheDocument();

    // Close second dialog
    const input = screen.getByTestId("dialog-input");
    fireEvent.change(input, { target: { value: "second result" } });
    fireEvent.click(screen.getByTestId("dialog-confirm"));

    await waitFor(() => {
      expect(screen.queryByText("Second Dialog")).not.toBeInTheDocument();
      expect(results).toContain("second result");
    });

    // First dialog should now be visible again
    await waitFor(() => {
      expect(screen.getByText("First Dialog")).toBeInTheDocument();
    });
  });

  it("should close all dialogs when closeAll is called", async () => {
    function TestComponent() {
      const dialog = useDialog();

      const handleOpen = () => {
        // Open dialogs and catch rejections to avoid unhandled promise errors
        dialog
          .open<string>({
            component: TestDialog as any,
            props: { message: "Dialog 1" },
          })
          .catch(() => {}); // Expected rejection when closeAll is called

        dialog
          .open<string>({
            component: TestDialog as any,
            props: { message: "Dialog 2" },
          })
          .catch(() => {}); // Expected rejection when closeAll is called
      };

      return (
        <>
          <button onClick={handleOpen}>Open Dialogs</button>
          <button onClick={() => dialog.closeAll()}>Close All</button>
        </>
      );
    }

    render(
      <DialogProvider disableRouterSync>
        <TestComponent />
      </DialogProvider>,
    );

    // Open dialogs - only the top dialog (Dialog 2) will be visible
    fireEvent.click(screen.getByText("Open Dialogs"));
    await waitFor(() => {
      // Only the top dialog is visible at a time
      expect(screen.getByText("Dialog 2")).toBeInTheDocument();
    });

    // Verify multiple dialogs are stacked (back button should be visible)
    expect(
      screen.getByLabelText("Go back to previous dialog"),
    ).toBeInTheDocument();

    // Close all
    fireEvent.click(screen.getByText("Close All"));

    await waitFor(() => {
      expect(screen.queryByText("Dialog 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Dialog 2")).not.toBeInTheDocument();
    });
  });
});
