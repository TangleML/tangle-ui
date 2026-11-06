import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Binding, ComponentSpec, Task } from "@/models/componentSpec";
import { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { FlowCanvas } from "./FlowCanvas";

let keyboard: KeyboardStore;
let spec: ComponentSpec;
const undoGroup = vi.fn((_label: string, apply: () => void) => apply());
const clearSelection = vi.fn();
const clearMultiSelection = vi.fn();

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({
    keyboard,
    editor: { clearSelection, clearMultiSelection },
    navigation: { parentContext: undefined },
  }),
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => ({ undo: { withGroup: undoGroup } }),
}));
vi.mock("@/routes/v2/shared/nodes/NodeRegistryContext", () => ({
  useNodeRegistry: () => ({
    getNodeTypes: () => ({}),
    getEdgeTypes: () => ({}),
    getByNodeId: () => ({
      entityType: "task",
      getPosition: () => ({ x: 0, y: 0 }),
    }),
  }),
}));
vi.mock("@/routes/v2/shared/hooks/useFlowCanvasState", () => ({
  useFlowCanvasState: () => ({
    displayNodes: [
      {
        id: "task_1",
        position: { x: 0, y: 0 },
        data: { label: "Selected task" },
        selected: true,
      },
    ],
    displayEdges: [
      {
        id: "edge_binding_1",
        source: "task_1",
        target: "task_1",
        selected: true,
      },
    ],
    selectionBehavior: {},
  }),
}));
vi.mock("@/routes/v2/shared/components/SubgraphBreadcrumbs", () => ({
  SubgraphBreadcrumbs: () => null,
}));
vi.mock("./components/CanvasUndoRedo", () => ({ CanvasUndoRedo: () => null }));
vi.mock("./components/FloatingSelectionToolbar", () => ({
  FloatingSelectionToolbar: () => null,
}));
vi.mock("./hooks/useDropBehavior", () => ({ useDropBehavior: () => ({}) }));

let deleteProgrammatically: () => Promise<unknown>;
function FlowProbe() {
  const flow = useReactFlow();
  useEffect(() => {
    deleteProgrammatically = () =>
      flow.deleteElements({ nodes: [{ id: "task_1" }] });
  }, [flow]);
  return null;
}
function Canvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvas spec={spec} />
      <FlowProbe />
    </ReactFlowProvider>
  );
}

async function press(key: string) {
  await act(async () => {
    fireEvent.keyDown(document.body, { key, code: key });
  });
  await act(async () => {
    fireEvent.keyUp(document.body, { key, code: key });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  keyboard = new KeyboardStore();
  spec = new ComponentSpec({ name: "Pipeline" });
  spec.addTask(
    new Task({ $id: "task_1", name: "Selected task", componentRef: {} }),
  );
  spec.addBinding(
    new Binding({
      $id: "binding_1",
      sourceEntityId: "task_1",
      sourcePortName: "output",
      targetEntityId: "task_1",
      targetPortName: "input",
    }),
  );
});

describe("real ReactFlow keyboard activity", () => {
  it.each(["Delete", "Backspace"])(
    "ignores %s while the editor is not listening and deletes once it is",
    async (key) => {
      render(<Canvas />);

      await press(key);
      expect(spec.tasks).toHaveLength(1);
      expect(spec.bindings).toHaveLength(1);

      act(() => keyboard.setListening(true));
      await press(key);
      await waitFor(() => expect(spec.tasks).toHaveLength(0));
      expect(spec.bindings).toHaveLength(0);
    },
  );

  it("keeps deliberate programmatic/agent deletion available while not listening", async () => {
    render(<Canvas />);
    await act(async () => {
      await deleteProgrammatically();
    });
    expect(spec.tasks).toHaveLength(0);
    expect(spec.bindings).toHaveLength(0);
  });
});
