import { describe, expect, it } from "vitest";

import { computePlacementPosition } from "./computePlacementPosition";
import { type Bounds, rectsOverlap } from "./geometry";

const rect = (x: number, y: number, width = 300, height = 100): Bounds => ({
  x,
  y,
  width,
  height,
});

describe("rectsOverlap", () => {
  it("detects overlap and separation", () => {
    expect(rectsOverlap(rect(0, 0), rect(50, 50))).toBe(true);
    expect(rectsOverlap(rect(0, 0), rect(0, 140))).toBe(false); // gap between
    expect(rectsOverlap(rect(0, 0), rect(400, 0))).toBe(false); // side by side
  });
});

describe("computePlacementPosition", () => {
  const anchor = rect(0, 0, 300, 100);

  it("places directly below in the same column when clear", () => {
    const pos = computePlacementPosition(anchor, [], { prefer: "below" });
    expect(pos).toEqual({ x: 0, y: 140 }); // anchorBottom(100) + gap(40)
  });

  it("pushes past a stacked node below until the slot is clear", () => {
    const below = rect(0, 120, 300, 100); // occupies y 120..220
    const above = rect(0, -160, 300, 100); // occupies y -160..-60 (forces below)
    const pos = computePlacementPosition(anchor, [below, above], {
      prefer: "below",
    });
    // below candidate 140 overlaps -> pushed to 220 + gap(40) = 260
    expect(pos).toEqual({ x: 0, y: 260 });
  });

  it("falls back above when below is far and above is closer", () => {
    const tallBelow = rect(0, 120, 300, 500); // occupies y 120..620
    const pos = computePlacementPosition(anchor, [tallBelow], {
      prefer: "below",
    });
    // below would be 660 (far); above is clear at -140 (closer) -> chosen
    expect(pos).toEqual({ x: 0, y: -140 });
  });

  it("keeps the new node in the anchor's column (same x)", () => {
    const shifted = rect(500, 0, 300, 100);
    const pos = computePlacementPosition(shifted, [], { prefer: "below" });
    expect(pos.x).toBe(500);
  });
});
