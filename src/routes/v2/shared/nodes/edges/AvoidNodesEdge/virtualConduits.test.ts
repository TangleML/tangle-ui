import type { Edge, Node } from "@xyflow/react";
import { describe, expect, test } from "vitest";

import type { HandleBoundsMap } from "@/components/shared/ReactFlow/FlowCanvas/utils/autolayout";
import type { GuidelineInfo } from "@/routes/v2/shared/nodes/types";

import { deriveVirtualConduitGuidelines } from "./virtualConduits";

function makeNode(
  id: string,
  x: number,
  y: number,
  width = 200,
  height = 100,
): Node {
  return {
    id,
    type: "task",
    position: { x, y },
    data: {},
    measured: { width, height },
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  handles?: { sourceHandle?: string; targetHandle?: string },
): Edge {
  return {
    id,
    source,
    target,
    sourceHandle: handles?.sourceHandle,
    targetHandle: handles?.targetHandle,
  };
}

function verticalAt(
  guidelines: GuidelineInfo[],
  coordinate: number,
): GuidelineInfo | undefined {
  return guidelines.find(
    (g) => g.orientation === "vertical" && g.coordinate === coordinate,
  );
}

describe("deriveVirtualConduitGuidelines", () => {
  test("emits only vertical channels per edge", () => {
    const nodes = [makeNode("s", 0, 0), makeNode("t", 400, 0)];
    const guidelines =
      deriveVirtualConduitGuidelines(nodes, [makeEdge("e", "s", "t")]).get(
        "e",
      ) ?? [];

    expect(guidelines).toHaveLength(2);
    expect(guidelines.every((g) => g.orientation === "vertical")).toBe(true);
  });

  test("bundles edges that share an output channel", () => {
    // s1/s2 sit in the same column (same x + width) so their right edges align.
    const nodes = [
      makeNode("s1", 0, 0),
      makeNode("s2", 0, 300),
      makeNode("t1", 400, 0),
      makeNode("t2", 400, 300),
    ];
    const edges = [makeEdge("e1", "s1", "t1"), makeEdge("e2", "s2", "t2")];

    const result = deriveVirtualConduitGuidelines(nodes, edges);

    // right edge (200) + offset (24) = 224
    const e1Out = verticalAt(result.get("e1") ?? [], 224);
    const e2Out = verticalAt(result.get("e2") ?? [], 224);

    expect(e1Out?.edgeTotal).toBe(2);
    expect(e2Out?.edgeTotal).toBe(2);
    expect(e1Out?.edgeIndex).not.toBe(e2Out?.edgeIndex);

    // Output channels hug the source, so their bundle fans right (away from it).
    expect(e1Out?.offsetDirection).toBe(1);
    expect(e2Out?.offsetDirection).toBe(1);
  });

  test("bundles edges that share an input channel even with unequal source widths", () => {
    const nodes = [
      makeNode("s1", 0, 0, 200),
      makeNode("s2", 0, 300, 300),
      makeNode("t1", 500, 0, 100),
      makeNode("t2", 500, 300, 100),
    ];
    const edges = [makeEdge("e1", "s1", "t1"), makeEdge("e2", "s2", "t2")];

    const result = deriveVirtualConduitGuidelines(nodes, edges);

    // target left (500) - offset (24) = 476
    const e1In = verticalAt(result.get("e1") ?? [], 476);
    const e2In = verticalAt(result.get("e2") ?? [], 476);

    expect(e1In?.edgeTotal).toBe(2);
    expect(e2In?.edgeTotal).toBe(2);
    expect(e1In?.edgeIndex).not.toBe(e2In?.edgeIndex);

    // Input channels hug the target, so their bundle fans left (away from it).
    expect(e1In?.offsetDirection).toBe(-1);
    expect(e2In?.offsetDirection).toBe(-1);

    // Output channels differ (224 vs 324) so each is a singleton with no offset.
    expect(verticalAt(result.get("e1") ?? [], 224)?.edgeTotal).toBe(1);
    expect(verticalAt(result.get("e2") ?? [], 324)?.edgeTotal).toBe(1);
  });

  test("a lone edge gets singleton channels with zero-offset totals", () => {
    const nodes = [makeNode("s", 0, 0), makeNode("t", 400, 0)];
    const edges = [makeEdge("e", "s", "t")];

    const guidelines = deriveVirtualConduitGuidelines(nodes, edges).get("e");

    expect(guidelines).toBeDefined();
    expect(verticalAt(guidelines ?? [], 224)?.edgeTotal).toBe(1);
    expect(verticalAt(guidelines ?? [], 376)?.edgeTotal).toBe(1);
  });

  test("orders an input channel so the top-most target port gets the outermost lane", () => {
    // Three sources (staggered widths so their output channels stay singletons)
    // all feed one target node's stacked input ports.
    const nodes = [
      makeNode("sTop", 0, 0, 200),
      makeNode("sMid", 0, 300, 250),
      makeNode("sBot", 0, 600, 300),
      makeNode("t", 500, 0, 100, 200),
    ];
    const edges = [
      makeEdge("eTop", "sTop", "t", { targetHandle: "input_a" }),
      makeEdge("eMid", "sMid", "t", { targetHandle: "input_b" }),
      makeEdge("eBot", "sBot", "t", { targetHandle: "input_c" }),
    ];

    // Handle Y offsets (relative to node top): a is top, c is bottom.
    const handleBounds: HandleBoundsMap = new Map([
      [
        "t",
        {
          source: new Map<string, number>(),
          target: new Map<string, number>([
            ["input_a", 20],
            ["input_b", 100],
            ["input_c", 180],
          ]),
        },
      ],
    ]);

    const result = deriveVirtualConduitGuidelines(nodes, edges, handleBounds);

    // target left (500) - offset (24) = 476
    const top = verticalAt(result.get("eTop") ?? [], 476);
    const mid = verticalAt(result.get("eMid") ?? [], 476);
    const bot = verticalAt(result.get("eBot") ?? [], 476);

    expect(top?.edgeTotal).toBe(3);
    // Input channel fans left; the top-most port gets the largest index, so its
    // offset (-edgeIndex * spacing) is the most negative (furthest left).
    expect(top?.edgeIndex).toBe(2);
    expect(mid?.edgeIndex).toBe(1);
    expect(bot?.edgeIndex).toBe(0);
  });

  test("falls back to stable ordering when handle bounds are unavailable", () => {
    const nodes = [
      makeNode("sTop", 0, 0, 200),
      makeNode("sBot", 0, 300, 200),
      makeNode("t", 500, 0, 100, 200),
    ];
    const edges = [
      makeEdge("eTop", "sTop", "t", { targetHandle: "input_a" }),
      makeEdge("eBot", "sBot", "t", { targetHandle: "input_c" }),
    ];

    const result = deriveVirtualConduitGuidelines(nodes, edges);

    const top = verticalAt(result.get("eTop") ?? [], 476);
    const bot = verticalAt(result.get("eBot") ?? [], 476);

    expect(top?.edgeTotal).toBe(2);
    expect(bot?.edgeTotal).toBe(2);
    expect(top?.edgeIndex).not.toBe(bot?.edgeIndex);
  });

  test("skips back-edges where the target is left of the source", () => {
    const nodes = [makeNode("s", 400, 0), makeNode("t", 0, 0)];
    const edges = [makeEdge("e", "s", "t")];

    const result = deriveVirtualConduitGuidelines(nodes, edges);

    expect(result.has("e")).toBe(false);
  });

  test("ignores edges touching unmeasured or skipped nodes", () => {
    const ghost: Node = {
      id: "g",
      type: "ghost",
      position: { x: 0, y: 0 },
      data: {},
      measured: { width: 200, height: 100 },
    };
    const nodes = [makeNode("s", 0, 0), ghost];
    const edges = [makeEdge("e", "s", "g")];

    const result = deriveVirtualConduitGuidelines(nodes, edges);

    expect(result.has("e")).toBe(false);
  });
});
