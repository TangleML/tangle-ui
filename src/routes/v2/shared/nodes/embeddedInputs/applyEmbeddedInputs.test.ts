import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { applyEmbeddedInputs } from "./applyEmbeddedInputs";

function makeNodes(): Node[] {
  return [
    { id: "input_a", type: "input", position: { x: 0, y: 0 }, data: {} },
    { id: "input_b", type: "input", position: { x: 0, y: 100 }, data: {} },
    { id: "input_c", type: "input", position: { x: 0, y: 200 }, data: {} },
    { id: "task_1", type: "task", position: { x: 300, y: 0 }, data: {} },
  ];
}

function makeEdges(): Edge[] {
  return [
    { id: "edge_0", source: "input_a", target: "task_1" },
    { id: "edge_1", source: "input_b", target: "task_1" },
  ];
}

describe("applyEmbeddedInputs", () => {
  it("hides input nodes that have at least one connection", () => {
    const { nodes } = applyEmbeddedInputs(makeNodes(), makeEdges());

    expect(nodes.find((n) => n.id === "input_a")).toBeUndefined();
    expect(nodes.find((n) => n.id === "input_b")).toBeUndefined();
  });

  it("keeps unconnected input nodes visible", () => {
    const { nodes } = applyEmbeddedInputs(makeNodes(), makeEdges());

    // input_c has no outgoing edge, so it stays.
    expect(nodes.find((n) => n.id === "input_c")).toBeDefined();
    // Non-input nodes are never removed.
    expect(nodes.find((n) => n.id === "task_1")).toBeDefined();
  });

  it("drops edges leaving hidden input nodes", () => {
    const { edges } = applyEmbeddedInputs(makeNodes(), makeEdges());

    expect(edges).toHaveLength(0);
  });

  it("preserves edges that do not originate from an input node", () => {
    const nodes = makeNodes();
    const edges: Edge[] = [
      { id: "edge_0", source: "input_a", target: "task_1" },
      { id: "edge_task", source: "task_1", target: "input_c" },
    ];

    const result = applyEmbeddedInputs(nodes, edges);

    expect(result.nodes.find((n) => n.id === "input_a")).toBeUndefined();
    expect(result.edges.map((e) => e.id)).toEqual(["edge_task"]);
  });

  it("returns inputs unchanged when nothing is connected", () => {
    const nodes: Node[] = [
      { id: "input_a", type: "input", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [];

    const result = applyEmbeddedInputs(nodes, edges);

    expect(result.nodes).toBe(nodes);
    expect(result.edges).toBe(edges);
  });
});
