import type { XYPosition } from "@xyflow/react";

import { type Bounds, rectsOverlap } from "./geometry";

const DEFAULT_GAP = 40;

export interface ComputePlacementOptions {
  /** Preferred direction from the anchor. Defaults to "below". */
  prefer?: "below" | "above";
  /** Vertical gap to leave between nodes. Defaults to 40. */
  gap?: number;
}

/**
 * Computes a position for a new node placed directly above or below an anchor
 * node, in the same column, at a Y that does not overlap any of `otherRects`.
 *
 * Starting just past the anchor in the preferred direction, it walks away from
 * the anchor past any overlapping node until the slot is clear, then does the
 * same in the opposite direction, and returns whichever clear slot is closer
 * to the anchor. Distance is intentionally unbounded — the caller is expected
 * to animate the viewport to reveal the result.
 */
export function computePlacementPosition(
  anchor: Bounds,
  otherRects: Bounds[],
  { prefer = "below", gap = DEFAULT_GAP }: ComputePlacementOptions = {},
): XYPosition {
  const width = anchor.width;
  const height = anchor.height;
  const x = anchor.x;

  const clearBelow = () => {
    let y = anchor.y + anchor.height + gap;
    // Walk down past any node the candidate rect overlaps.
    // Re-checks from scratch each pass so stacked nodes are all cleared.
    let moved = true;
    while (moved) {
      moved = false;
      for (const other of otherRects) {
        if (rectsOverlap({ x, y, width, height }, other)) {
          y = other.y + other.height + gap;
          moved = true;
        }
      }
    }
    return y;
  };

  const clearAbove = () => {
    let y = anchor.y - height - gap;
    let moved = true;
    while (moved) {
      moved = false;
      for (const other of otherRects) {
        if (rectsOverlap({ x, y, width, height }, other)) {
          y = other.y - height - gap;
          moved = true;
        }
      }
    }
    return y;
  };

  const belowY = clearBelow();
  const aboveY = clearAbove();

  // Distance of each clear slot from the anchor's nearest edge.
  const belowDist = belowY - (anchor.y + anchor.height);
  const aboveDist = anchor.y - (aboveY + height);

  const preferBelow =
    prefer === "below" ? belowDist <= aboveDist : belowDist < aboveDist;

  return { x, y: preferBelow ? belowY : aboveY };
}
