import { act, cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";

import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";

import { useRunViewSelectionSync } from "./useRunViewSelectionSync";

vi.mock("@/routes/v2/pages/RunView/components/RunViewContextPanel", () => ({
  RunViewContextPanel: () => null,
}));

afterEach(cleanup);

function mountSelection() {
  let stores: ReturnType<typeof useSharedStores>;
  function Selection() {
    const current = useSharedStores();
    useRunViewSelectionSync();
    useEffect(() => {
      stores = current;
    }, [current]);
    return null;
  }
  const view = render(
    <SharedStoreProvider>
      <Selection />
    </SharedStoreProvider>,
  );
  return { ...stores!, unmount: view.unmount };
}

it("opens Properties for a selected task and clears selection when the user closes it", async () => {
  const { editor, windows } = mountSelection();
  await act(async () => {
    editor.selectNode("task_1", "task");
  });
  expect(windows.getWindowById("context-panel")).toBeDefined();
  act(() => windows.closeWindow("context-panel"));
  expect(editor.hasAnySelection).toBe(false);
});

it("suppresses Properties when native selection precedes drag start, then reveals it on click", async () => {
  const { editor, windows } = mountSelection();
  await act(async () => {
    editor.selectNode("task_1", "task");
    editor.setDraggedSincePointerDown(true);
  });
  expect(editor.selectedNodeId).toBe("task_1");
  expect(windows.getWindowById("context-panel")).toBeUndefined();

  act(() => {
    editor.setDraggedSincePointerDown(false);
    editor.requestContextPanelReveal();
  });
  expect(windows.getWindowById("context-panel")).toBeDefined();
});

it("does not reopen Properties after selection is cleared or the watcher unmounts", async () => {
  const { editor, windows, unmount } = mountSelection();
  await act(async () => {
    editor.selectNode("task_1", "task");
    editor.clearSelection();
  });
  expect(windows.getWindowById("context-panel")).toBeUndefined();

  await act(async () => {
    editor.selectNode("task_1", "task");
    unmount();
  });
  expect(windows.getWindowById("context-panel")).toBeUndefined();
});

it("retains multi-selection when the single-node Properties panel closes", async () => {
  const { editor, windows } = mountSelection();
  await act(async () => {
    editor.selectNode("task_1", "task");
  });
  act(() =>
    editor.setSelectedNodes([
      { id: "task_1", type: "task", position: { x: 0, y: 0 } },
      { id: "task_2", type: "task", position: { x: 100, y: 0 } },
    ]),
  );
  expect(windows.getWindowById("context-panel")).toBeUndefined();
  expect(editor.selectedNodes.map(({ id }) => id)).toEqual([
    "task_1",
    "task_2",
  ]);
});

it("retains native edge selection when it deselects a node with Properties open", async () => {
  const { editor, windows } = mountSelection();
  await act(async () => {
    editor.selectNode("task_1", "task");
  });
  act(() => {
    editor.setSelectedEdges(["edge_1"]);
    editor.setSelectedNodes([]);
  });
  expect(windows.getWindowById("context-panel")).toBeUndefined();
  expect(editor.selectedEdgeIds).toEqual(["edge_1"]);
});
