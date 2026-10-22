import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { ComponentSpec, Task } from "@/models/componentSpec";
import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";

import { useSelectionWindowSync } from "./useSelectionWindowSync";

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({ setNodes: vi.fn(), setEdges: vi.fn() }),
}));
vi.mock(
  "@/routes/v2/pages/Editor/components/ContextPanel/ContextPanel",
  () => ({ ContextPanelContent: () => null }),
);
vi.mock(
  "@/routes/v2/pages/Editor/components/PinnedTaskContent/PinnedTaskContent",
  () => ({ PinnedTaskContent: () => null }),
);

const CONTEXT_PANEL_WINDOW_ID = "context-panel";

type Stores = ReturnType<typeof useSharedStores>;

function makeTask($id: string) {
  return new Task({
    $id,
    name: $id,
    componentRef: {
      spec: { name: "s", implementation: { container: { image: "alpine" } } },
    },
  });
}

function Editor({
  spec,
  onStores,
}: {
  spec: ComponentSpec;
  onStores: (s: Stores) => void;
}) {
  const stores = useSharedStores();
  useSelectionWindowSync();
  useEffect(() => {
    stores.navigation.initNavigation(spec);
    onStores(stores);
  }, [spec, stores, onStores]);
  return null;
}

function mountEditor(spec: ComponentSpec) {
  let stores: Stores | undefined;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SharedStoreProvider>{children}</SharedStoreProvider>
  );
  render(
    <Editor
      spec={spec}
      onStores={(s) => {
        stores = s;
      }}
    />,
    { wrapper },
  );
  return stores!;
}

function makeSpec() {
  return new ComponentSpec({
    $id: "spec_1",
    name: "Pipeline",
    tasks: [makeTask("task_1")],
  });
}

describe("useSelectionWindowSync", () => {
  it("does not reveal Properties when native selection precedes drag-start", async () => {
    const { editor, windows } = mountEditor(makeSpec());
    await act(async () => {
      editor.selectNode("task_1", "task");
      editor.setDraggedSincePointerDown(true);
    });
    expect(editor.selectedNodeId).toBe("task_1");
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeUndefined();
  });

  it("preserves selected edges when Properties closes after node deselection", async () => {
    const { editor, windows } = mountEditor(makeSpec());
    await act(async () => editor.selectNode("task_1", "task"));
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeDefined();
    await act(async () => {
      editor.setSelectedEdges(["edge_1"]);
      editor.setSelectedNodes([]);
    });
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeUndefined();
    expect(editor.selectedEdgeIds).toEqual(["edge_1"]);
  });
  it("opens the properties panel for a selected task", async () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    await act(async () => editor.selectNode("task_1", "task"));

    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeDefined();
  });

  it("closes the properties panel when the selected task is deleted", async () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    await act(async () => editor.selectNode("task_1", "task"));
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeDefined();

    await act(async () => spec.deleteTaskById("task_1"));

    expect(editor.selectedNodeId).toBeNull();
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeUndefined();
  });

  it("leaves the panel shut for a task selected by dragging it", async () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    await act(async () => {
      editor.setDraggedSincePointerDown(true);
      editor.selectNode("task_1", "task");
    });

    expect(editor.selectedNodeId).toBe("task_1");
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeUndefined();
  });

  it("opens the panel for the click after a drag", async () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    await act(async () => {
      editor.setDraggedSincePointerDown(true);
      editor.selectNode("task_1", "task");
    });
    await act(async () => {
      editor.setDraggedSincePointerDown(false);
      editor.selectNode(null, null);
      editor.selectNode("task_1", "task");
    });

    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeDefined();
  });

  it("opens the panel for a click on the task just dragged, which selects nothing new", async () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    await act(async () => {
      editor.setDraggedSincePointerDown(true);
      editor.selectNode("task_1", "task");
    });
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeUndefined();

    await act(async () => {
      editor.setDraggedSincePointerDown(false);
      editor.requestContextPanelReveal();
    });

    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeDefined();
  });

  it("opens nothing for a click on empty canvas", async () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    await act(async () => {
      editor.requestContextPanelReveal();
    });

    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeUndefined();
  });

  it("leaves the panel open when an unselected task is deleted", async () => {
    const spec = new ComponentSpec({
      $id: "spec_1",
      name: "Pipeline",
      tasks: [makeTask("task_1"), makeTask("task_2")],
    });
    const { editor, windows } = mountEditor(spec);

    await act(async () => editor.selectNode("task_1", "task"));
    await act(async () => spec.deleteTaskById("task_2"));

    expect(editor.selectedNodeId).toBe("task_1");
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeDefined();
  });
});
