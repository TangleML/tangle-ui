import type { Node } from "@xyflow/react";
import { describe, expect, test } from "vitest";

import { computeAlignmentSnap } from "./virtualConduits";

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

describe("computeAlignmentSnap", () => {
  test("snaps the dragged left edge onto a target left edge within threshold", () => {
    const target = makeNode("t", 0, 0);
    const dragged = makeNode("d", 6, 400);

    const snap = computeAlignmentSnap(new Set(["d"]), [target, dragged], 8);

    expect(snap).not.toBeNull();
    expect(snap?.dx).toBe(-6);
    expect(snap?.dy).toBe(0);
    expect(snap?.verticalGuides).toContain(0);
  });

  test("does not snap when the nearest edge is beyond the threshold", () => {
    const target = makeNode("t", 0, 0);
    const dragged = makeNode("d", 40, 400);

    const snap = computeAlignmentSnap(new Set(["d"]), [target, dragged], 8);

    expect(snap).toBeNull();
  });

  test("snaps X and Y independently", () => {
    const target = makeNode("t", 0, 0);
    // left off by 5 (x=5), top off by -4 (y=-4)
    const dragged = makeNode("d", 5, -4);

    const snap = computeAlignmentSnap(new Set(["d"]), [target, dragged], 8);

    expect(snap?.dx).toBe(-5);
    expect(snap?.dy).toBe(4);
    expect(snap?.verticalGuides).toContain(0);
    expect(snap?.horizontalGuides).toContain(0);
  });

  test("snaps the dragged right edge onto a target right edge", () => {
    // target right edge at 200; dragged (width 100) right edge at 195 -> snap +5
    const target = makeNode("t", 0, 0, 200);
    const dragged = makeNode("d", 95, 400, 100);

    const snap = computeAlignmentSnap(new Set(["d"]), [target, dragged], 8);

    expect(snap?.dx).toBe(5);
    expect(snap?.verticalGuides).toContain(200);
  });

  test("uses the bounding box of a multi-node selection", () => {
    const target = makeNode("t", 0, 0);
    // Two dragged nodes: bounding box left edge is min(6, 300) = 6 -> snap -6.
    const d1 = makeNode("d1", 6, 400);
    const d2 = makeNode("d2", 300, 400);

    const snap = computeAlignmentSnap(
      new Set(["d1", "d2"]),
      [target, d1, d2],
      8,
    );

    expect(snap?.dx).toBe(-6);
    expect(snap?.verticalGuides).toContain(0);
  });

  test("returns null when there is no dragged geometry", () => {
    const target = makeNode("t", 0, 0);

    const snap = computeAlignmentSnap(new Set(["missing"]), [target], 8);

    expect(snap).toBeNull();
  });

  test("ignores skipped node types as snap targets", () => {
    const ghost: Node = {
      id: "g",
      type: "ghost",
      position: { x: 0, y: 0 },
      data: {},
      measured: { width: 200, height: 100 },
    };
    const dragged = makeNode("d", 6, 400);

    const snap = computeAlignmentSnap(new Set(["d"]), [ghost, dragged], 8);

    expect(snap).toBeNull();
  });
});
