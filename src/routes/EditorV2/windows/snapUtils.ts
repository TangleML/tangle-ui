import { TOP_NAV_HEIGHT } from "@/utils/constants";

import type {
  Position,
  Size,
  SnapPreviewType,
  ViewportBounds,
  WindowConfig,
} from "./types";
import {
  DETACH_THRESHOLD,
  EDGE_SNAP_THRESHOLD,
  MAGNETIC_SNAP_THRESHOLD,
} from "./types";

/**
 * Get viewport bounds accounting for top navigation
 */
export function getViewportBounds(): ViewportBounds {
  return {
    top: TOP_NAV_HEIGHT,
    left: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };
}

/**
 * Get the visible height of the viewport (excluding top nav)
 */
export function getViewportHeight(): number {
  return window.innerHeight - TOP_NAV_HEIGHT;
}

/**
 * Check if a window position is near the left edge of the viewport
 */
export function isNearLeftEdge(x: number): boolean {
  return x <= EDGE_SNAP_THRESHOLD;
}

/**
 * Check if a window position is near the right edge of the viewport
 */
export function isNearRightEdge(x: number, windowWidth: number): boolean {
  const rightEdge = x + windowWidth;
  return rightEdge >= window.innerWidth - EDGE_SNAP_THRESHOLD;
}

/**
 * Detect if a window should show edge dock preview
 */
export function detectEdgeSnap(
  position: Position,
  size: Size,
): { side: "left" | "right" } | null {
  if (isNearLeftEdge(position.x)) {
    return { side: "left" };
  }
  if (isNearRightEdge(position.x, size.width)) {
    return { side: "right" };
  }
  return null;
}

/**
 * Calculate window bottom edge Y coordinate
 */
export function getWindowBottom(window: WindowConfig): number {
  return window.position.y + window.size.height;
}

/**
 * Check if window top is within magnetic snap range of another window's bottom
 */
export function isWithinMagneticRange(
  windowTopY: number,
  otherWindowBottom: number,
): boolean {
  const distance = Math.abs(windowTopY - otherWindowBottom);
  return distance <= MAGNETIC_SNAP_THRESHOLD;
}

/**
 * Find a potential parent window for magnetic attachment.
 * Returns the window whose bottom edge is closest to the dragged window's top.
 */
export function findMagneticAttachTarget(
  draggedWindowId: string,
  draggedPosition: Position,
  allWindows: WindowConfig[],
): WindowConfig | null {
  let closestWindow: WindowConfig | null = null;
  let closestDistance = Infinity;

  for (const win of allWindows) {
    // Skip self, hidden windows, and minimized windows
    if (
      win.id === draggedWindowId ||
      win.state === "hidden" ||
      win.state === "minimized"
    ) {
      continue;
    }

    const windowBottom = getWindowBottom(win);
    const distance = Math.abs(draggedPosition.y - windowBottom);

    if (distance <= MAGNETIC_SNAP_THRESHOLD && distance < closestDistance) {
      closestDistance = distance;
      closestWindow = win;
    }
  }

  return closestWindow;
}

/**
 * Check if window has been dragged far enough to detach from parent
 */
export function shouldDetach(
  currentPosition: Position,
  attachedPosition: Position,
): boolean {
  const dx = Math.abs(currentPosition.x - attachedPosition.x);
  const dy = Math.abs(currentPosition.y - attachedPosition.y);
  return dx >= DETACH_THRESHOLD || dy >= DETACH_THRESHOLD;
}

/**
 * Calculate the position for a window when attaching to a parent
 */
export function calculateAttachPosition(
  parentWindow: WindowConfig,
  _childWidth: number,
): Position {
  return {
    x: parentWindow.position.x, // Align left edges
    y: getWindowBottom(parentWindow), // Place at parent's bottom
  };
}

/**
 * Calculate docked window dimensions based on dock side
 */
export function calculateDockedDimensions(
  side: "left" | "right",
  currentWidth: number,
): { position: Position; height: number } {
  const viewportHeight = getViewportHeight();

  return {
    position: {
      x: side === "left" ? 0 : window.innerWidth - currentWidth,
      y: TOP_NAV_HEIGHT,
    },
    height: viewportHeight,
  };
}

/**
 * Detect all snap possibilities for the current drag state
 */
export function detectSnapPreview(
  windowId: string,
  position: Position,
  size: Size,
  allWindows: WindowConfig[],
  isAttached: boolean,
  attachedPosition?: Position,
): SnapPreviewType | null {
  // If attached, check if should detach first (no snap preview while attached unless detaching)
  if (isAttached && attachedPosition) {
    if (!shouldDetach(position, attachedPosition)) {
      // Still attached, no new snap preview
      return null;
    }
  }

  // Check for edge snap first (higher priority)
  const edgeSnap = detectEdgeSnap(position, size);
  if (edgeSnap) {
    return { type: "edge", side: edgeSnap.side };
  }

  // Check for magnetic attachment
  const attachTarget = findMagneticAttachTarget(windowId, position, allWindows);
  if (attachTarget) {
    return {
      type: "attach",
      parentId: attachTarget.id,
      parentBottom: getWindowBottom(attachTarget),
      parentLeft: attachTarget.position.x,
    };
  }

  return null;
}

/**
 * Get all windows in an attachment chain starting from a parent
 * Returns windows in order from top to bottom
 */
export function getAttachmentChain(
  parentId: string,
  allWindows: WindowConfig[],
): WindowConfig[] {
  const chain: WindowConfig[] = [];

  function findChildren(currentParentId: string) {
    for (const win of allWindows) {
      if (win.attachedTo?.parentId === currentParentId) {
        chain.push(win);
        // Recursively find children of this window
        findChildren(win.id);
      }
    }
  }

  findChildren(parentId);
  return chain;
}

/**
 * Calculate the total height of a window and all its attached children
 */
export function calculateStackHeight(
  windowId: string,
  allWindows: WindowConfig[],
): number {
  const window = allWindows.find((w) => w.id === windowId);
  if (!window) return 0;

  let totalHeight = window.size.height;
  const chain = getAttachmentChain(windowId, allWindows);

  for (const child of chain) {
    totalHeight += child.size.height;
  }

  return totalHeight;
}

