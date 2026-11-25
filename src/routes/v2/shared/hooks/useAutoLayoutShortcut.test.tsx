import { cleanup, renderHook } from "@testing-library/react";
import type { Edge, Node } from "@xyflow/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  autoLayoutNodes,
  type NodeSize,
} from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import {
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";
import { estimateFullCardSize } from "@/routes/v2/shared/nodes/estimateFullCardSize";
import { EditorStore } from "@/routes/v2/shared/store/editorStore";
import { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";

import { useAutoLayoutShortcut } from "./useAutoLayoutShortcut";

const SIMPLIFIED_ZOOM = 0.25;
const DETAILED_ZOOM = 1;
const MIN_ZOOM = 0.1;
const PLACEHOLDER_SCALE_AT_MIN_ZOOM = 3;

const wideComponent = (inputCount: number) => ({
  spec: {
    name: "Query",
    inputs: Array.from({ length: inputCount }, (_, index) => ({
      name: `input_${index}`,
    })),
    outputs: [{ name: "table" }],
    implementation: { container: { image: "query" } },
  },
});

const spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
  name: "Metrics",
  inputs: [{ name: "source_table" }, { name: "model_name" }],
  outputs: [{ name: "metrics_table" }],
  implementation: {
    graph: {
      tasks: {
        Prepare: {
          componentRef: wideComponent(25),
          arguments: { input_0: { graphInput: { inputName: "source_table" } } },
        },
        "Evaluate A": {
          componentRef: wideComponent(20),
          arguments: {
            input_0: { taskOutput: { taskId: "Prepare", outputName: "table" } },
            input_1: { graphInput: { inputName: "model_name" } },
          },
        },
        "Evaluate B": {
          componentRef: wideComponent(20),
          arguments: {
            input_0: { taskOutput: { taskId: "Prepare", outputName: "table" } },
            input_1: { graphInput: { inputName: "model_name" } },
          },
        },
        Combine: {
          componentRef: wideComponent(12),
          arguments: {
            input_0: {
              taskOutput: { taskId: "Evaluate A", outputName: "table" },
            },
            input_1: {
              taskOutput: { taskId: "Evaluate B", outputName: "table" },
            },
          },
        },
      },
      outputValues: {
        metrics_table: {
          taskOutput: { taskId: "Combine", outputName: "table" },
        },
      },
    },
  },
});

const placeholderNode = (id: string, type: string, size: NodeSize): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: {},
  measured: size,
});

const placeholderNodes = (scale: number): Node[] => [
  ...spec.tasks.map((task) =>
    placeholderNode(task.$id, "task", {
      width: 240 * scale,
      height: 96 * scale,
    }),
  ),
  ...spec.inputs.map((input) =>
    placeholderNode(input.$id, "input", {
      width: 220 * scale,
      height: 80 * scale,
    }),
  ),
  ...spec.outputs.map((output) =>
    placeholderNode(output.$id, "output", {
      width: 220 * scale,
      height: 80 * scale,
    }),
  ),
];

const edges: Edge[] = [...spec.bindings].map((binding) => ({
  id: binding.$id,
  source: binding.sourceEntityId,
  target: binding.targetEntityId,
}));

let zoom = SIMPLIFIED_ZOOM;
let nodes = placeholderNodes(1);
const applyLayout = vi.fn();
const editor = new EditorStore();
const keyboard = new KeyboardStore();

vi.mock("@xyflow/react", () => ({
  SelectionMode: { Full: "full" },
  useReactFlow: () => ({
    getNodes: () => nodes,
    getEdges: () => edges,
    getZoom: () => zoom,
    fitView: vi.fn(),
  }),
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ editor, keyboard }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  nodes = placeholderNodes(1);
});
afterEach(cleanup);

const layOutCentered = (): Node[] => {
  renderHook(() => useAutoLayoutShortcut(applyLayout, spec));
  keyboard.invokeShortcut("auto-layout", { algorithm: "sugiyama_centered" });
  return applyLayout.mock.calls[0][0];
};

const overlappingPairs = (laidOut: Node[], sizeOf: (node: Node) => NodeSize) =>
  laidOut.flatMap((a, index) =>
    laidOut.slice(index + 1).flatMap((b) => {
      const aSize = sizeOf(a);
      const bSize = sizeOf(b);
      const overlaps =
        a.position.x < b.position.x + bSize.width &&
        b.position.x < a.position.x + aSize.width &&
        a.position.y < b.position.y + bSize.height &&
        b.position.y < a.position.y + aSize.height;
      return overlaps ? [`${a.id} / ${b.id}`] : [];
    }),
  );

it("spaces zoomed-out nodes for their full cards, not their placeholders", () => {
  zoom = SIMPLIFIED_ZOOM;

  const laidOut = layOutCentered();

  expect(
    overlappingPairs(laidOut, (node) => estimateFullCardSize(node, spec)!),
  ).toEqual([]);
});

it("spaces nodes for their placeholders when those outgrow the full cards", () => {
  zoom = MIN_ZOOM;
  nodes = placeholderNodes(PLACEHOLDER_SCALE_AT_MIN_ZOOM);

  const laidOut = layOutCentered();

  expect(
    overlappingPairs(laidOut, (node) => estimateFullCardSize(node, spec)!),
  ).toEqual([]);
  expect(
    overlappingPairs(laidOut, (node) => node.measured as NodeSize),
  ).toEqual([]);
});

it("keeps using measured sizes when nodes render as full cards", () => {
  zoom = DETAILED_ZOOM;

  const laidOut = layOutCentered();

  expect(laidOut).toEqual(autoLayoutNodes(nodes, edges, "sugiyama_centered"));
});
