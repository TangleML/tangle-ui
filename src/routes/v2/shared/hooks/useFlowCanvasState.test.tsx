import { act, cleanup, render } from "@testing-library/react";
import { observer } from "mobx-react-lite";
import { afterEach, expect, it } from "vitest";

import { Binding, ComponentSpec, Task } from "@/models/componentSpec";
import { NodeRegistryProvider } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";
import { taskManifestBase } from "@/routes/v2/shared/nodes/TaskNode/taskManifestBase";
import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

import { useFlowCanvasState } from "./useFlowCanvasState";

afterEach(cleanup);

function mountCanvas() {
  const spec = new ComponentSpec({
    name: "Canvas test",
    tasks: ["task_one", "task_two"].map(
      ($id) => new Task({ $id, name: $id, componentRef: {} }),
    ),
    bindings: [
      new Binding({
        $id: "connection",
        sourceEntityId: "task_one",
        targetEntityId: "task_two",
        sourcePortName: "output",
        targetPortName: "input",
      }),
    ],
  });
  const registry = new NodeTypeRegistry();
  registry.register({
    ...taskManifestBase,
    updatePosition: (_undo, document, id, position) =>
      document.updateNodePosition(id, position),
    deleteNode: (_undo, document, id) => document.deleteTaskById(id),
  });
  let current: ReturnType<typeof useFlowCanvasState>;
  let stores: ReturnType<typeof useSharedStores>;
  const Canvas = observer(function Canvas() {
    stores = useSharedStores();
    current = useFlowCanvasState({ spec });
    return null;
  });
  render(
    <SharedStoreProvider>
      <NodeRegistryProvider registry={registry}>
        <Canvas />
      </NodeRegistryProvider>
    </SharedStoreProvider>,
  );
  return {
    spec,
    get canvas() {
      return current!;
    },
    get stores() {
      return stores!;
    },
  };
}

it("uses one selection for programmatic actions, native multiselect, and clearing", () => {
  const view = mountCanvas();
  act(() => view.stores.editor.selectNode("task_one", "task"));
  expect(
    view.canvas.displayNodes
      .filter((node) => node.selected)
      .map((node) => node.id),
  ).toEqual(["task_one"]);

  act(() =>
    view.canvas.rfOnNodesChange([
      { type: "select", id: "task_two", selected: true },
    ]),
  );
  expect(view.stores.editor.selectedNodeId).toBeNull();
  expect(view.stores.editor.multiSelection.map((node) => node.id)).toEqual([
    "task_one",
    "task_two",
  ]);
  expect(view.canvas.displayNodes.every((node) => node.selected)).toBe(true);

  act(() =>
    view.canvas.rfOnEdgesChange([
      { type: "select", id: "edge_connection", selected: true },
    ]),
  );
  expect(view.stores.editor.selectedEdgeIds).toEqual(["edge_connection"]);
  expect(view.canvas.displayEdges[0].selected).toBe(true);
  expect(view.stores.canvasOverlay.activeOverlayId).toBe(
    "edge-selection-highlight",
  );

  act(() => view.stores.editor.clearSelection());
  expect(view.canvas.displayNodes.some((node) => node.selected)).toBe(false);
  expect(view.canvas.displayEdges.some((edge) => edge.selected)).toBe(false);
  expect(view.stores.canvasOverlay.isActive).toBe(false);
});

it("keeps drag geometry transient and selection intact when the document changes", () => {
  const view = mountCanvas();
  act(() => view.stores.editor.selectNode("task_one", "task"));
  act(() =>
    view.canvas.rfOnNodesChange([
      {
        type: "position",
        id: "task_one",
        position: { x: 120, y: 230 },
        dragging: true,
      },
    ]),
  );
  expect(view.canvas.displayNodes[0].position).toEqual({ x: 120, y: 230 });
  expect(view.spec.tasks[0].annotations.has(EDITOR_POSITION_ANNOTATION)).toBe(
    false,
  );

  act(() => view.spec.updateNodePosition("task_one", { x: 130, y: 240 }));
  expect(view.canvas.displayNodes[0].position).toEqual({ x: 130, y: 240 });
  expect(view.canvas.displayNodes[0].selected).toBe(true);

  act(() => view.spec.renameTask("task_one", "Renamed task"));
  expect(view.canvas.displayNodes[0].data.name).toBe("Renamed task");
  expect(view.canvas.displayNodes[0].selected).toBe(true);
});

it("prunes removed nodes and edges from a multi-selection", () => {
  const view = mountCanvas();
  act(() => {
    view.canvas.rfOnNodesChange([
      { type: "select", id: "task_one", selected: true },
      { type: "select", id: "task_two", selected: true },
    ]);
    view.canvas.rfOnEdgesChange([
      { type: "select", id: "edge_connection", selected: true },
    ]);
  });
  act(() => view.spec.deleteTaskById("task_one"));
  expect(view.stores.editor.selectedNodeId).toBe("task_two");
  expect(view.stores.editor.multiSelection).toEqual([]);
  expect(view.stores.editor.selectedEdgeIds).toEqual([]);
  expect(view.canvas.displayNodes.map((node) => node.id)).toEqual(["task_two"]);
});
