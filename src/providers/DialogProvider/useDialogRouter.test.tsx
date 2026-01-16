import { renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DialogInstance } from "./types";
import { useDialogRouter } from "./useDialogRouter";

// Mock navigation functions
const mockNavigate = vi.fn();
let mockSearchParams: Record<string, any> = {};

// Mock Tanstack Router
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockSearchParams,
}));

// Helper to create a mock ref for dialog IDs
const createDialogIdsRef = (ids: string[] = []): RefObject<Set<string>> => ({
  current: new Set(ids),
});

describe("useDialogRouter", () => {
  const mockCancel = vi.fn();
  const emptyPendingRef = createDialogIdsRef();
  const emptyClosingRef = createDialogIdsRef();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
  });

  it("should cancel dialog when URL params are cleared (back button)", () => {
    const stack: DialogInstance[] = [
      {
        id: "dialog1",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
        routeKey: "test",
      },
    ];

    // Set initial search params
    mockSearchParams = { dialog: "test", dialogId: "dialog1" };

    const { rerender } = renderHook(
      ({ stack }) =>
        useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
      {
        initialProps: { stack },
      },
    );

    // Simulate back button (params cleared)
    mockSearchParams = {};
    rerender({ stack });

    // Should call cancel on the dialog
    expect(mockCancel).toHaveBeenCalledWith("dialog1");
  });

  it("should clean URL when dialog in URL but not in stack", () => {
    const stack: DialogInstance[] = [];

    // Set search params with dialog that doesn't exist
    mockSearchParams = {
      dialog: "test",
      dialogId: "non-existent",
      other: "param",
    };

    renderHook(() =>
      useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
    );

    // Should navigate to clean URL
    expect(mockNavigate).toHaveBeenCalledWith({
      search: { other: "param" },
    });
  });

  it("should NOT clean URL when dialog is pending (being opened)", () => {
    const stack: DialogInstance[] = [];
    const pendingRef = createDialogIdsRef(["pending-dialog"]);

    // Set search params with dialog that is pending
    mockSearchParams = {
      dialog: "test",
      dialogId: "pending-dialog",
      other: "param",
    };

    renderHook(() =>
      useDialogRouter(stack, mockCancel, pendingRef, emptyClosingRef),
    );

    // Should NOT navigate because dialog is pending
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should update URL when stack shrinks (programmatic close)", () => {
    const initialStack: DialogInstance[] = [
      {
        id: "dialog1",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
      },
      {
        id: "dialog2",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
      },
    ];

    mockSearchParams = {
      dialog: "test",
      dialogId: "dialog2",
    };

    const { rerender } = renderHook(
      ({ stack }) =>
        useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
      {
        initialProps: { stack: initialStack },
      },
    );

    // Simulate stack shrinking (dialog closed)
    const newStack = [initialStack[0]];
    rerender({ stack: newStack });

    // Should navigate to clean URL
    expect(mockNavigate).toHaveBeenCalledWith({
      search: {},
    });
  });

  it("should not navigate when stack grows", () => {
    const initialStack: DialogInstance[] = [
      {
        id: "dialog1",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
      },
    ];

    const { rerender } = renderHook(
      ({ stack }) =>
        useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
      {
        initialProps: { stack: initialStack },
      },
    );

    mockNavigate.mockClear();

    // Simulate stack growing (new dialog opened)
    const newStack = [
      ...initialStack,
      {
        id: "dialog2",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
      },
    ];
    rerender({ stack: newStack });

    // Should not navigate
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should cancel multiple dialogs with routeKey when back button pressed", () => {
    const stack: DialogInstance[] = [
      {
        id: "dialog1",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
        routeKey: "first",
      },
      {
        id: "dialog2",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
        routeKey: "second",
      },
    ];

    // Set initial params
    mockSearchParams = {
      dialog: "second",
      dialogId: "dialog2",
    };

    const { rerender } = renderHook(() =>
      useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
    );

    // Clear params to simulate back button
    mockSearchParams = {};
    rerender();

    // Should cancel the top dialog
    expect(mockCancel).toHaveBeenCalledWith("dialog2");
  });

  it("should cancel nested dialog when URL points to parent dialog (back button from nested dialog)", () => {
    // Scenario: Dialog A is open, Dialog B opens inside A
    // User presses back button, URL now points to A's params
    // Dialog B should be cancelled, Dialog A should remain
    const stack: DialogInstance[] = [
      {
        id: "dialog-a",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
        routeKey: "dialog-a",
      },
      {
        id: "dialog-b",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
        routeKey: "dialog-b",
      },
    ];

    // URL initially points to dialog B
    mockSearchParams = {
      dialog: "dialog-b",
      dialogId: "dialog-b",
    };

    const { rerender } = renderHook(() =>
      useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
    );

    // Simulate back button - URL now points to dialog A
    mockSearchParams = {
      dialog: "dialog-a",
      dialogId: "dialog-a",
    };
    rerender();

    // Should cancel dialog B (the nested one), not dialog A
    expect(mockCancel).toHaveBeenCalledWith("dialog-b");
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it("should cancel only routed dialogs above when navigating back to parent", () => {
    // Scenario: Dialog A (routed) -> Dialog B (not routed) -> Dialog C (routed)
    // Back button should close Dialog C
    const stack: DialogInstance[] = [
      {
        id: "dialog-a",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
        routeKey: "dialog-a",
      },
      {
        id: "dialog-b-no-route",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
        // No routeKey
      },
      {
        id: "dialog-c",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
        routeKey: "dialog-c",
      },
    ];

    mockSearchParams = {
      dialog: "dialog-c",
      dialogId: "dialog-c",
    };

    const { rerender } = renderHook(() =>
      useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
    );

    // Back to dialog A
    mockSearchParams = {
      dialog: "dialog-a",
      dialogId: "dialog-a",
    };
    rerender();

    // Should cancel dialog C (routed), not dialog B (not routed)
    expect(mockCancel).toHaveBeenCalledWith("dialog-c");
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it("should NOT clean URL when stack shrinks but URL dialog is still in stack", () => {
    // Scenario: Dialog A and B are open, URL points to A
    // Dialog B is removed from stack (closed by back nav handler)
    // URL should NOT be cleaned because A is still in the stack
    const initialStack: DialogInstance[] = [
      {
        id: "dialog-a",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
        routeKey: "dialog-a",
      },
      {
        id: "dialog-b",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
        routeKey: "dialog-b",
      },
    ];

    // URL points to dialog A (after user pressed back)
    mockSearchParams = {
      dialog: "dialog-a",
      dialogId: "dialog-a",
    };

    const { rerender } = renderHook(
      ({ stack }) =>
        useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
      {
        initialProps: { stack: initialStack },
      },
    );

    mockNavigate.mockClear();

    // Stack shrinks to just dialog A (dialog B was closed)
    const newStack = [initialStack[0]];
    rerender({ stack: newStack });

    // Should NOT navigate because dialog A (in URL) is still in the stack
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should NOT clean URL when dialog is being closed (closingDialogIds)", () => {
    const stack: DialogInstance[] = [];
    const closingRef = createDialogIdsRef(["closing-dialog"]);

    // Set search params with dialog that is being closed
    mockSearchParams = {
      dialog: "test",
      dialogId: "closing-dialog",
      other: "param",
    };

    renderHook(() =>
      useDialogRouter(stack, mockCancel, emptyPendingRef, closingRef),
    );

    // Should NOT navigate because dialog is being closed
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should NOT cancel dialogs when any dialog is being closed", () => {
    const stack: DialogInstance[] = [
      {
        id: "dialog-a",
        component: vi.fn() as any,
        resolve: vi.fn(),
        reject: vi.fn(),
        routeKey: "dialog-a",
      },
    ];

    // URL is empty (simulating the race condition when close updates URL)
    mockSearchParams = {};

    // Mark that a dialog is being closed
    const closingRef = createDialogIdsRef(["some-closing-dialog"]);

    renderHook(() =>
      useDialogRouter(stack, mockCancel, emptyPendingRef, closingRef),
    );

    // Should NOT cancel because a dialog is being closed (close function handles URL)
    expect(mockCancel).not.toHaveBeenCalled();
  });
});
