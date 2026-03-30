import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

let mockSearchParams: Record<string, any> = {};
const mockNavigate = vi.fn((options: any) => {
  if (options?.search) {
    mockSearchParams = { ...options.search };
  }
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({ ...mockSearchParams }),
}));

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
    mockSearchParams = {};
    mockNavigate.mockClear();
  });

  it("should throw error when used outside DialogProvider", () => {
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

    fireEvent.click(screen.getByText("Open Dialog"));
    await waitFor(() => {
      expect(screen.getByText("Test Dialog")).toBeInTheDocument();
    });

    const input = screen.getByTestId("dialog-input");
    fireEvent.change(input, { target: { value: "test result" } });

    fireEvent.click(screen.getByTestId("dialog-confirm"));

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

    fireEvent.click(screen.getByText("Open Dialog"));
    await waitFor(() => {
      expect(screen.getByText("Test Dialog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("dialog-cancel"));

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

    fireEvent.click(screen.getByText("Open First"));
    await waitFor(() => {
      expect(screen.getByText("First Dialog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Open Second"));
    await waitFor(() => {
      expect(screen.getByText("Second Dialog")).toBeInTheDocument();
    });

    expect(screen.queryByText("First Dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Second Dialog")).toBeInTheDocument();

    expect(
      screen.getByLabelText("Go back to previous dialog"),
    ).toBeInTheDocument();

    const input = screen.getByTestId("dialog-input");
    fireEvent.change(input, { target: { value: "second result" } });
    fireEvent.click(screen.getByTestId("dialog-confirm"));

    await waitFor(() => {
      expect(screen.queryByText("Second Dialog")).not.toBeInTheDocument();
      expect(results).toContain("second result");
    });

    await waitFor(() => {
      expect(screen.getByText("First Dialog")).toBeInTheDocument();
    });
  });

  it("should close all dialogs when closeAll is called", async () => {
    function TestComponent() {
      const dialog = useDialog();

      const handleOpen = () => {
        dialog
          .open<string>({
            component: TestDialog as any,
            props: { message: "Dialog 1" },
          })
          .catch(() => {});

        dialog
          .open<string>({
            component: TestDialog as any,
            props: { message: "Dialog 2" },
          })
          .catch(() => {});
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

    fireEvent.click(screen.getByText("Open Dialogs"));
    await waitFor(() => {
      expect(screen.getByText("Dialog 2")).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText("Go back to previous dialog"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close All"));

    await waitFor(() => {
      expect(screen.queryByText("Dialog 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Dialog 2")).not.toBeInTheDocument();
    });
  });
});
