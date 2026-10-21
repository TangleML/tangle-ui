import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ComponentSpec, Task } from "@/models/componentSpec";
import { EditorStore } from "@/routes/v2/shared/store/editorStore";
import { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { useAutoLayoutShortcut } from "./useAutoLayoutShortcut";
import { useFitViewOnFocus } from "./useFitViewOnFocus";
import { useLayoutUnplacedSpec } from "./useLayoutUnplacedSpec";

const fitView = vi.fn().mockResolvedValue(true);
const applyLayout = vi.fn();
const editor = new EditorStore();
const keyboard = new KeyboardStore();
const task = new Task({ name: "Target", componentRef: {} });
const spec = new ComponentSpec({ name: "Unplaced pipeline", tasks: [task] });
let initialized = false;
const getNodes = () => [
  {
    id: task.$id,
    data: {},
    position: { x: 0, y: 0 },
    measured: { width: 100, height: 100 },
  },
];
const getEdges = () => [];
vi.mock("@xyflow/react", () => ({
  useNodesInitialized: () => initialized,
  useReactFlow: () => ({ getNodes, getEdges, fitView }),
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ editor, keyboard }),
}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  initialized = false;
  editor.resetState();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("restores node focus after late measurement lays out an unplaced pipeline", async () => {
  editor.selectNode(task.$id, "task");
  editor.setPendingFocusNode(task.$id);
  const { rerender } = renderHook(() => {
    useFitViewOnFocus();
    useAutoLayoutShortcut(applyLayout);
    useLayoutUnplacedSpec(spec);
  });
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(fitView).toHaveBeenCalledOnce();
  expect(editor.pendingFocusNodeId).toBeNull();
  initialized = true;
  rerender();
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(applyLayout).toHaveBeenCalledOnce();
  expect(fitView).toHaveBeenCalledTimes(2);
  for (const [options] of fitView.mock.calls)
    expect(options.nodes).toEqual([{ id: task.$id }]);
});

it("still frames the whole graph when layout has no node target", async () => {
  initialized = true;
  renderHook(() => {
    useAutoLayoutShortcut(applyLayout);
    useLayoutUnplacedSpec(spec);
  });
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(fitView).toHaveBeenCalledExactlyOnceWith({
    maxZoom: 1,
    duration: 300,
  });
});
