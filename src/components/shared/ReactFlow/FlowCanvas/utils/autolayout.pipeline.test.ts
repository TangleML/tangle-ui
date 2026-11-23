import type { Edge, Node } from "@xyflow/react";
import { describe, expect, test } from "vitest";

import { autoLayoutNodes, type HandleBoundsMap } from "./autolayout";

function makeNode(id: string, width = 200, height = 100): Node {
  return {
    id,
    type: "task",
    position: { x: 0, y: 0 },
    data: {},
    measured: { width, height },
  };
}

function makeEdge(
  source: string,
  target: string,
  sourceHandle: string | null = null,
  targetHandle: string | null = null,
): Edge {
  return {
    id: `${source}-${target}-${sourceHandle}-${targetHandle}`,
    source,
    target,
    sourceHandle,
    targetHandle,
  };
}

function positionOf(nodes: Node[], id: string): { x: number; y: number } {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new Error(`Node ${id} not found in layout result`);
  return node.position;
}

function rectsOverlap(a: Node, b: Node): boolean {
  const aw = a.measured?.width ?? 0;
  const ah = a.measured?.height ?? 0;
  const bw = b.measured?.width ?? 0;
  const bh = b.measured?.height ?? 0;
  return (
    a.position.x < b.position.x + bw &&
    a.position.x + aw > b.position.x &&
    a.position.y < b.position.y + bh &&
    a.position.y + ah > b.position.y
  );
}

describe("layoutPipelineGrid", () => {
  test("ranks a chain left-to-right into distinct columns", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];

    const result = autoLayoutNodes(nodes, edges, "pipeline_grid");

    const a = positionOf(result, "a");
    const b = positionOf(result, "b");
    const c = positionOf(result, "c");

    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
  });

  test("orders sources to match the target's input-port order", () => {
    const nodes = [makeNode("s1"), makeNode("s2"), makeNode("target")];
    // s1 feeds the lower input port, s2 feeds the upper input port.
    const edges = [
      makeEdge("s1", "target", "output_out", "input_bottom"),
      makeEdge("s2", "target", "output_out", "input_top"),
    ];

    const handleBounds: HandleBoundsMap = new Map([
      [
        "target",
        {
          source: new Map<string, number>(),
          target: new Map<string, number>([
            ["input_top", 20],
            ["input_bottom", 80],
          ]),
        },
      ],
    ]);

    const result = autoLayoutNodes(nodes, edges, "pipeline_grid", handleBounds);

    const s1 = positionOf(result, "s1");
    const s2 = positionOf(result, "s2");

    // s2 (upper port) should sit above s1 (lower port).
    expect(s2.y).toBeLessThan(s1.y);
  });

  test("places a connected source and target on the same grid row", () => {
    const nodes = [makeNode("s"), makeNode("t")];
    const edges = [makeEdge("s", "t")];

    const result = autoLayoutNodes(nodes, edges, "pipeline_grid");

    const s = positionOf(result, "s");
    const t = positionOf(result, "t");

    // Target sits one column to the right, on the same row (aligned Y).
    expect(s.x).toBeLessThan(t.x);
    expect(t.y).toBe(s.y);
  });

  test("keeps a fan-out input's targets on distinct, non-overlapping rows", () => {
    const nodes = [makeNode("in"), makeNode("t1"), makeNode("t2")];
    const edges = [makeEdge("in", "t1"), makeEdge("in", "t2")];

    const result = autoLayoutNodes(nodes, edges, "pipeline_grid");

    const input = positionOf(result, "in");
    const t1 = positionOf(result, "t1");
    const t2 = positionOf(result, "t2");

    // The input sits in an earlier column than the targets it feeds.
    expect(input.x).toBeLessThan(t1.x);
    expect(input.x).toBeLessThan(t2.x);
    // Targets share a column but land on distinct, non-overlapping rows.
    expect(t1.x).toBe(t2.x);
    expect(Math.abs(t1.y - t2.y)).toBeGreaterThanOrEqual(100);
  });

  test("keeps multiple inputs feeding the same port from overlapping", () => {
    const nodes = [makeNode("inA"), makeNode("inB"), makeNode("t")];
    const edges = [
      makeEdge("inA", "t", "output_out", "input_in"),
      makeEdge("inB", "t", "output_out", "input_in"),
    ];

    const handleBounds: HandleBoundsMap = new Map([
      [
        "inA",
        {
          source: new Map<string, number>([["output_out", 60]]),
          target: new Map<string, number>(),
        },
      ],
      [
        "inB",
        {
          source: new Map<string, number>([["output_out", 60]]),
          target: new Map<string, number>(),
        },
      ],
      [
        "t",
        {
          source: new Map<string, number>(),
          target: new Map<string, number>([["input_in", 40]]),
        },
      ],
    ]);

    const result = autoLayoutNodes(nodes, edges, "pipeline_grid", handleBounds);

    const inA = positionOf(result, "inA");
    const inB = positionOf(result, "inB");
    const [upper, lower] = inA.y <= inB.y ? [inA, inB] : [inB, inA];

    // Both inputs sit in the same column but do not overlap vertically.
    expect(lower.y).toBeGreaterThanOrEqual(upper.y + 100);
  });

  test("never overlaps nodes in a branching, merging graph", () => {
    const nodes = [
      makeNode("root"),
      makeNode("a"),
      makeNode("b"),
      makeNode("c"),
      makeNode("d"),
      makeNode("e"),
    ];
    const edges = [
      makeEdge("root", "a"),
      makeEdge("root", "b"),
      makeEdge("a", "c"),
      makeEdge("b", "c"),
      makeEdge("b", "d"),
      makeEdge("c", "e"),
      makeEdge("d", "e"),
    ];

    const result = autoLayoutNodes(nodes, edges, "pipeline_grid");

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        expect(
          rectsOverlap(result[i], result[j]),
          `${result[i].id} and ${result[j].id} must not overlap`,
        ).toBe(false);
      }
    }
  });

  test("aligns nodes sharing a row across columns onto the same Y", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];

    const result = autoLayoutNodes(nodes, edges, "pipeline_grid");

    const a = positionOf(result, "a");
    const b = positionOf(result, "b");
    const c = positionOf(result, "c");

    expect(b.y).toBe(a.y);
    expect(c.y).toBe(a.y);
  });

  test("returns nodes unchanged when there are none", () => {
    const result = autoLayoutNodes([], [], "pipeline_grid");
    expect(result).toEqual([]);
  });
});
