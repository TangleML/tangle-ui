import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { ReactFlowProvider, useReactFlow, useStoreApi } from "@xyflow/react";
import { useLayoutEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";

import {
  Binding,
  ComponentSpec,
  Input,
  Output,
  serializeComponentSpecToText,
  Task,
} from "@/models/componentSpec";
import { runViewRegistry } from "@/routes/v2/pages/RunView/nodes";
import { ReadOnlyFlowCanvas } from "@/routes/v2/shared/components/ReadOnlyFlowCanvas";
import { NodeRegistryProvider } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import { SharedStoreProvider } from "@/routes/v2/shared/store/SharedStoreContext";

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => false,
}));
vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionDataOptional: () => null,
}));
vi.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));
vi.mock("@/routes/v2/shared/components/SubgraphBreadcrumbs", () => ({
  SubgraphBreadcrumbs: () => null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderRunCanvas() {
  const spec = new ComponentSpec({
    name: "Greeting pipeline",
    inputs: [new Input({ $id: "input_name", name: "name" })],
    outputs: [new Output({ $id: "output_greeting", name: "greeting" })],
    tasks: [
      new Task({
        $id: "task_greet",
        name: "Greet",
        componentRef: {
          spec: {
            name: "Greeter",
            inputs: [{ name: "name" }, { name: "unused" }],
            outputs: [{ name: "greeting" }],
            implementation: { container: { image: "example/greeter" } },
          },
        },
      }),
    ],
    bindings: [
      new Binding({
        $id: "in",
        sourceEntityId: "input_name",
        sourcePortName: "name",
        targetEntityId: "task_greet",
        targetPortName: "name",
      }),
      new Binding({
        $id: "out",
        sourceEntityId: "task_greet",
        sourcePortName: "greeting",
        targetEntityId: "output_greeting",
        targetPortName: "greeting",
      }),
    ],
  });
  let flow!: ReturnType<typeof useReactFlow>;
  let store!: ReturnType<typeof useStoreApi>;
  function FlowProbe() {
    const instance = useReactFlow();
    const storeApi = useStoreApi();
    useLayoutEffect(() => {
      flow = instance;
      store = storeApi;
    }, [instance, storeApi]);
    return null;
  }
  const view = render(
    <SharedStoreProvider>
      <NodeRegistryProvider registry={runViewRegistry}>
        <SpecProvider spec={spec}>
          <ReactFlowProvider>
            <ReadOnlyFlowCanvas spec={spec} nodesDraggable={false}>
              <FlowProbe />
            </ReadOnlyFlowCanvas>
          </ReactFlowProvider>
        </SpecProvider>
      </NodeRegistryProvider>
    </SharedStoreProvider>,
  );
  const handle = (nodeId: string, handleId: string) => {
    const element = view.container.querySelector(
      `.react-flow__handle[data-nodeid="${nodeId}"][data-handleid="${handleId}"]`,
    );
    expect(element).not.toBeNull();
    return element!;
  };
  return { ...view, spec, flow, store, handle };
}

it.each([
  ["task_greet", "input_name", "edge_in"],
  ["task_greet", "output_greeting", "edge_out"],
  ["input_name", "output_input_name", "edge_in"],
  ["output_greeting", "input_output_greeting", "edge_out"],
])("selects the connection for %s / %s", async (nodeId, handleId, edgeId) => {
  const { handle, flow, spec, container } = renderRunCanvas();
  const initialYaml = serializeComponentSpecToText(spec);

  fireEvent.click(handle(nodeId, handleId));

  await waitFor(() => {
    expect(
      flow
        .getEdges()
        .filter((edge) => edge.selected)
        .map((edge) => edge.id),
    ).toEqual([edgeId]);
  });
  const selectedEdge = flow.getEdges().find((edge) => edge.id === edgeId)!;
  for (const id of [selectedEdge.source, selectedEdge.target]) {
    expect(
      container.querySelector(`[data-testid="rf__node-${id}"] .ring-4`),
    ).not.toBeNull();
  }
  expect(serializeComponentSpecToText(spec)).toBe(initialYaml);
});

it("applies edge selection changes and clears the highlight on the canvas", async () => {
  const { store, flow, container } = renderRunCanvas();

  // React Flow emits this change when an edge is clicked.
  act(() =>
    store
      .getState()
      .triggerEdgeChanges([{ id: "edge_in", type: "select", selected: true }]),
  );

  await waitFor(() => expect(flow.getEdge("edge_in")?.selected).toBe(true));
  expect(container.querySelector(".ring-4")).not.toBeNull();
  fireEvent.click(container.querySelector(".react-flow__pane")!);
  await waitFor(() =>
    expect(flow.getEdges().some((edge) => edge.selected)).toBe(false),
  );
  expect(container.querySelector(".ring-4")).toBeNull();
});

it("changes the highlighted port and clears it for an unconnected handle", async () => {
  const { handle, flow } = renderRunCanvas();
  fireEvent.click(handle("task_greet", "input_name"));
  await waitFor(() => expect(flow.getEdge("edge_in")?.selected).toBe(true));
  fireEvent.click(handle("task_greet", "output_greeting"));
  await waitFor(() => {
    expect(flow.getEdge("edge_in")?.selected).toBe(false);
    expect(flow.getEdge("edge_out")?.selected).toBe(true);
  });
  fireEvent.click(handle("task_greet", "input_unused"));
  await waitFor(() =>
    expect(flow.getEdges().some((edge) => edge.selected)).toBe(false),
  );
});

it("keeps handles inspectable when zoomed out without starting connections or deleting edges", async () => {
  const { handle, store, flow, spec } = renderRunCanvas();
  const initialYaml = serializeComponentSpecToText(spec);
  act(() => store.setState({ transform: [0, 0, 0.2] }));

  // Simplified ports overlap; the last, unconnected input is on top.
  const inputHandle = handle("task_greet", "input_unused");
  fireEvent.mouseDown(inputHandle, { button: 0 });
  expect(store.getState().connection.inProgress).toBe(false);
  expect(inputHandle).not.toHaveClass("connectablestart");
  expect(inputHandle).not.toHaveClass("connectableend");
  fireEvent.click(inputHandle);
  await waitFor(() => expect(flow.getEdge("edge_in")?.selected).toBe(true));

  fireEvent.click(handle("output_greeting", "input_output_greeting"));
  await waitFor(() => expect(flow.getEdge("edge_out")?.selected).toBe(true));
  act(() =>
    store.getState().triggerEdgeChanges([{ id: "edge_out", type: "remove" }]),
  );
  await waitFor(() => expect(flow.getEdges()).toHaveLength(2));
  expect(serializeComponentSpecToText(spec)).toBe(initialYaml);
});
