import { renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DialogInstance } from "./types";
import { useDialogRouter } from "./useDialogRouter";

const mockNavigate = vi.fn();
let mockSearchParams: Record<string, any> = {};

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockSearchParams,
}));

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

    mockSearchParams = { dialog: "test", dialogId: "dialog1" };

    const { rerender } = renderHook(
      ({ stack }) =>
        useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
      {
        initialProps: { stack },
      },
    );

    mockSearchParams = {};
    rerender({ stack });

    expect(mockCancel).toHaveBeenCalledWith("dialog1");
  });

  it("should clean URL when dialog in URL but not in stack", () => {
    const stack: DialogInstance[] = [];

    mockSearchParams = {
      dialog: "test",
      dialogId: "non-existent",
      other: "param",
    };

    renderHook(() =>
      useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      search: { other: "param" },
    });
  });

  it("should NOT clean URL when dialog is pending (being opened)", () => {
    const stack: DialogInstance[] = [];
    const pendingRef = createDialogIdsRef(["pending-dialog"]);

    mockSearchParams = {
      dialog: "test",
      dialogId: "pending-dialog",
      other: "param",
    };

    renderHook(() =>
      useDialogRouter(stack, mockCancel, pendingRef, emptyClosingRef),
    );

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

    const newStack = [initialStack[0]];
    rerender({ stack: newStack });

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

    mockSearchParams = {
      dialog: "second",
      dialogId: "dialog2",
    };

    const { rerender } = renderHook(() =>
      useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
    );

    mockSearchParams = {};
    rerender();

    expect(mockCancel).toHaveBeenCalledWith("dialog2");
  });

  it("should cancel nested dialog when URL points to parent dialog (back button from nested dialog)", () => {
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

    mockSearchParams = {
      dialog: "dialog-b",
      dialogId: "dialog-b",
    };

    const { rerender } = renderHook(() =>
      useDialogRouter(stack, mockCancel, emptyPendingRef, emptyClosingRef),
    );

    mockSearchParams = {
      dialog: "dialog-a",
      dialogId: "dialog-a",
    };
    rerender();

    expect(mockCancel).toHaveBeenCalledWith("dialog-b");
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it("should cancel only routed dialogs above when navigating back to parent", () => {
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

    mockSearchParams = {
      dialog: "dialog-a",
      dialogId: "dialog-a",
    };
    rerender();

    expect(mockCancel).toHaveBeenCalledWith("dialog-c");
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it("should NOT clean URL when stack shrinks but URL dialog is still in stack", () => {
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

    const newStack = [initialStack[0]];
    rerender({ stack: newStack });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should NOT clean URL when dialog is being closed (closingDialogIds)", () => {
    const stack: DialogInstance[] = [];
    const closingRef = createDialogIdsRef(["closing-dialog"]);

    mockSearchParams = {
      dialog: "test",
      dialogId: "closing-dialog",
      other: "param",
    };

    renderHook(() =>
      useDialogRouter(stack, mockCancel, emptyPendingRef, closingRef),
    );

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

    mockSearchParams = {};

    const closingRef = createDialogIdsRef(["some-closing-dialog"]);

    renderHook(() =>
      useDialogRouter(stack, mockCancel, emptyPendingRef, closingRef),
    );

    expect(mockCancel).not.toHaveBeenCalled();
  });
});
