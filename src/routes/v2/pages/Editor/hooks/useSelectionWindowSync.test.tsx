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
  it("opens the properties panel for a selected task", () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    act(() => editor.selectNode("task_1", "task"));

    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeDefined();
  });

  it("closes the properties panel when the selected task is deleted", () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    act(() => editor.selectNode("task_1", "task"));
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeDefined();

    act(() => spec.deleteTaskById("task_1"));

    expect(editor.selectedNodeId).toBeNull();
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeUndefined();
  });

  it("leaves the panel shut for a task selected by dragging it", () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    act(() => {
      editor.setDraggedSincePointerDown(true);
      editor.selectNode("task_1", "task");
    });

    expect(editor.selectedNodeId).toBe("task_1");
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeUndefined();
  });

  it("opens the panel for the click after a drag", () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    act(() => {
      editor.setDraggedSincePointerDown(true);
      editor.selectNode("task_1", "task");
    });
    act(() => {
      editor.setDraggedSincePointerDown(false);
      editor.selectNode(null, null);
      editor.selectNode("task_1", "task");
    });

    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeDefined();
  });

  it("opens the panel for a click on the task just dragged, which selects nothing new", () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    act(() => {
      editor.setDraggedSincePointerDown(true);
      editor.selectNode("task_1", "task");
    });
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeUndefined();

    act(() => {
      editor.setDraggedSincePointerDown(false);
      editor.requestContextPanelReveal();
    });

    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeDefined();
  });

  it("opens nothing for a click on empty canvas", () => {
    const spec = makeSpec();
    const { editor, windows } = mountEditor(spec);

    act(() => {
      editor.requestContextPanelReveal();
    });

    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeUndefined();
  });

  it("leaves the panel open when an unselected task is deleted", () => {
    const spec = new ComponentSpec({
      $id: "spec_1",
      name: "Pipeline",
      tasks: [makeTask("task_1"), makeTask("task_2")],
    });
    const { editor, windows } = mountEditor(spec);

    act(() => editor.selectNode("task_1", "task"));
    act(() => spec.deleteTaskById("task_2"));

    expect(editor.selectedNodeId).toBe("task_1");
    expect(windows.getWindowById(CONTEXT_PANEL_WINDOW_ID)).toBeDefined();
  });
});
