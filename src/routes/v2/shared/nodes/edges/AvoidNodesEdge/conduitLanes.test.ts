import type { Edge, Node, XYPosition } from "@xyflow/react";
import { describe, expect, test } from "vitest";

import {
  computeGutterDemand,
  type GridCell,
  GUTTER_MARGIN,
  planConduitRoutes,
  TRACK_SPACING,
} from "./conduitLanes";

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

interface Segment {
  a: XYPosition;
  b: XYPosition;
}

function toSegments(points: XYPosition[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({ a: points[i], b: points[i + 1] });
  }
  return segments;
}

function overlapLength(
  lo1: number,
  hi1: number,
  lo2: number,
  hi2: number,
): number {
  return Math.min(hi1, hi2) - Math.max(lo1, lo2);
}

/** True when two axis-aligned segments run along the same line and overlap. */
function collinearOverlap(s1: Segment, s2: Segment): boolean {
  const s1Vertical = s1.a.x === s1.b.x;
  const s2Vertical = s2.a.x === s2.b.x;
  const s1Horizontal = s1.a.y === s1.b.y;
  const s2Horizontal = s2.a.y === s2.b.y;

  if (s1Vertical && s2Vertical && s1.a.x === s2.a.x) {
    return (
      overlapLength(
        Math.min(s1.a.y, s1.b.y),
        Math.max(s1.a.y, s1.b.y),
        Math.min(s2.a.y, s2.b.y),
        Math.max(s2.a.y, s2.b.y),
      ) > 0
    );
  }

  if (s1Horizontal && s2Horizontal && s1.a.y === s2.a.y) {
    return (
      overlapLength(
        Math.min(s1.a.x, s1.b.x),
        Math.max(s1.a.x, s1.b.x),
        Math.min(s2.a.x, s2.b.x),
        Math.max(s2.a.x, s2.b.x),
      ) > 0
    );
  }

  return false;
}

function anyCollinearOverlap(a: XYPosition[], b: XYPosition[]): boolean {
  const segA = toSegments(a);
  const segB = toSegments(b);
  return segA.some((s1) => segB.some((s2) => collinearOverlap(s1, s2)));
}

describe("planConduitRoutes", () => {
  test("gives adjacent-column edges from one port distinct vertical tracks", () => {
    const nodes = [
      makeNode("s", 0, 0),
      makeNode("t1", 300, 0),
      makeNode("t2", 300, 300),
    ];
    const edges = [makeEdge("e1", "s", "t1"), makeEdge("e2", "s", "t2")];

    const routes = planConduitRoutes(nodes, edges);
    const e1 = routes.get("e1");
    const e2 = routes.get("e2");
    if (!e1 || !e2) throw new Error("expected routes");

    // Both leave the same port but turn vertical at different x, so the fan is
    // visible instead of blending into one line.
    expect(e1[1].x).not.toBe(e2[1].x);
  });

  test("routes a multi-column edge through a single row gutter", () => {
    const nodes = [
      makeNode("s", 0, 0),
      makeNode("m", 300, 0),
      makeNode("t", 600, 300),
    ];
    const edges = [makeEdge("e", "s", "t")];

    const route = planConduitRoutes(nodes, edges).get("e");
    if (!route) throw new Error("expected a route");

    // Canonical 6-point bus: exit, bus (two points at one Y), entry.
    expect(route).toHaveLength(6);
    const busY = route[2].y;
    expect(route[3].y).toBe(busY);
    // Bus runs in the gutter between the source row (bottom 100) and target row
    // (top 300), clearing the intermediate node.
    expect(busY).toBeGreaterThan(100);
    expect(busY).toBeLessThan(300);
    // Exit sits left of entry so the bus flows left-to-right.
    expect(route[1].x).toBeLessThan(route[4].x);
  });

  test("keeps parallel edges on distinct tracks with no collinear overlap", () => {
    const nodes = [
      makeNode("s0", 0, 0),
      makeNode("s1", 0, 300),
      makeNode("s2", 0, 600),
      makeNode("m", 300, 0),
      makeNode("t0", 600, 0),
      makeNode("t1", 600, 300),
      makeNode("t2", 600, 600),
    ];
    const edges = [
      makeEdge("e0", "s0", "t0"),
      makeEdge("e1", "s1", "t1"),
      makeEdge("e2", "s2", "t2"),
    ];

    const routes = planConduitRoutes(nodes, edges);
    const ids = ["e0", "e1", "e2"];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = routes.get(ids[i]);
        const b = routes.get(ids[j]);
        if (!a || !b) throw new Error("expected routes");
        expect(
          anyCollinearOverlap(a, b),
          `${ids[i]} and ${ids[j]} must not overlap`,
        ).toBe(false);
      }
    }
  });

  test("fans edges sharing an output port onto distinct exit tracks", () => {
    const nodes = [
      makeNode("s", 0, 0),
      makeNode("m", 300, 0),
      makeNode("t0", 600, 0),
      makeNode("t1", 600, 300),
      makeNode("t2", 600, 600),
    ];
    const edges = [
      makeEdge("e0", "s", "t0"),
      makeEdge("e1", "s", "t1"),
      makeEdge("e2", "s", "t2"),
    ];

    const routes = planConduitRoutes(nodes, edges);
    const exitXs = ["e0", "e1", "e2"].map((id) => {
      const route = routes.get(id);
      if (!route) throw new Error("expected a route");
      return route[1].x;
    });

    expect(new Set(exitXs).size).toBe(exitXs.length);

    // Exit tracks must hug the source's right edge (x=200) so the shared
    // horizontal stub at the port stays tiny; otherwise the fanned edges blend
    // into one line before peeling off.
    const sourceRight = 200;
    for (const x of exitXs) {
      expect(x).toBeGreaterThanOrEqual(sourceRight + GUTTER_MARGIN);
      expect(x).toBeLessThanOrEqual(
        sourceRight + GUTTER_MARGIN + exitXs.length * TRACK_SPACING,
      );
    }
  });

  test("spreads a hub's buses across target-row gutters", () => {
    // One hub feeding four targets in different rows. Anchoring buses on the
    // target row must distribute the long horizontal runs vertically instead of
    // stacking them all in the hub's row gutter (which reads as one dense band).
    const nodes = [
      makeNode("hub", 0, 0),
      makeNode("m", 300, 0),
      makeNode("t0", 600, 0),
      makeNode("t1", 600, 300),
      makeNode("t2", 600, 600),
      makeNode("t3", 600, 900),
    ];
    const edges = [
      makeEdge("e0", "hub", "t0"),
      makeEdge("e1", "hub", "t1"),
      makeEdge("e2", "hub", "t2"),
      makeEdge("e3", "hub", "t3"),
    ];

    const routes = planConduitRoutes(nodes, edges);
    const busY = (id: string): number => {
      const route = routes.get(id);
      if (!route) throw new Error(`expected route ${id}`);
      // Canonical 6-point bus: the two middle points share the bus Y.
      expect(route[2].y).toBe(route[3].y);
      return route[2].y;
    };

    // Buses drop lower for lower targets, so no two distant targets share a lane.
    expect(busY("e3")).toBeGreaterThan(busY("e2"));
    expect(busY("e2")).toBeGreaterThan(busY("e1"));
    // At least three distinct horizontal bands are in play for four edges.
    expect(new Set([busY("e0"), busY("e1"), busY("e2"), busY("e3")]).size).toBe(
      4,
    );
  });

  test("omits back-edges so the caller can fall back", () => {
    const nodes = [makeNode("s", 400, 0), makeNode("t", 0, 0)];
    const routes = planConduitRoutes(nodes, [makeEdge("e", "s", "t")]);
    expect(routes.has("e")).toBe(false);
  });

  test("skips edges touching unmeasured or skipped nodes", () => {
    const ghost: Node = {
      id: "g",
      type: "ghost",
      position: { x: 300, y: 0 },
      data: {},
      measured: { width: 200, height: 100 },
    };
    const nodes = [makeNode("s", 0, 0), ghost];
    const routes = planConduitRoutes(nodes, [makeEdge("e", "s", "g")]);
    expect(routes.has("e")).toBe(false);
  });
});

describe("computeGutterDemand", () => {
  function cells(entries: Array<[string, GridCell]>): Map<string, GridCell> {
    return new Map(entries);
  }

  test("counts one vertical track per adjacent-column edge", () => {
    const cellByNode = cells([
      ["s", { col: 0, row: 0 }],
      ["t1", { col: 1, row: 0 }],
      ["t2", { col: 1, row: 1 }],
    ]);
    const edges = [makeEdge("e1", "s", "t1"), makeEdge("e2", "s", "t2")];

    const demand = computeGutterDemand(cellByNode, edges, 1);

    expect(demand.vertical.get(0)).toBe(2);
    expect(demand.horizontal.size).toBe(0);
  });

  test("counts exit, entry, and bus tracks for a multi-column edge", () => {
    const cellByNode = cells([
      ["s", { col: 0, row: 0 }],
      ["m", { col: 1, row: 0 }],
      ["t", { col: 2, row: 1 }],
    ]);
    const demand = computeGutterDemand(
      cellByNode,
      [makeEdge("e", "s", "t")],
      1,
    );

    // Exit gutter (col 0) and entry gutter (col 1) each get a vertical track.
    expect(demand.vertical.get(0)).toBe(1);
    expect(demand.vertical.get(1)).toBe(1);
    // Bus runs in the gutter just above the target row (row 1 -> gutter 0).
    expect(demand.horizontal.get(0)).toBe(1);
  });

  test("ignores back-edges", () => {
    const cellByNode = cells([
      ["s", { col: 2, row: 0 }],
      ["t", { col: 0, row: 0 }],
    ]);
    const demand = computeGutterDemand(
      cellByNode,
      [makeEdge("e", "s", "t")],
      0,
    );
    expect(demand.vertical.size).toBe(0);
    expect(demand.horizontal.size).toBe(0);
  });
});
