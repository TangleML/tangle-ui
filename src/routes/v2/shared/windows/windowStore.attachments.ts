import { getAttachmentChain, getWindowBottom } from "./snapUtils";
import type { WindowConfig } from "./types";

export function attachWindow(
  windows: Record<string, WindowConfig>,
  childId: string,
  parentId: string,
): void {
  const childWindow = windows[childId];
  const parentWindow = windows[parentId];

  if (!childWindow || !parentWindow) return;
  if (childId === parentId) return;
  if (parentWindow.state === "hidden" || parentWindow.state === "minimized") {
    return;
  }

  childWindow.attachedTo = { parentId, offsetX: 0 };
  childWindow.position = {
    x: parentWindow.position.x,
    y: getWindowBottom(parentWindow),
  };

  if (childWindow.dockState !== "none") {
    childWindow.dockState = "none";
  }
}

export function detachWindow(
  windows: Record<string, WindowConfig>,
  id: string,
): void {
  const win = windows[id];
  if (!win?.attachedTo) return;
  win.attachedTo = undefined;
}

function findChainRoot(
  windows: Record<string, WindowConfig>,
  windowId: string,
): string {
  let currentId = windowId;
  let current = windows[currentId];

  while (current?.attachedTo?.parentId) {
    const parent = windows[current.attachedTo.parentId];
    if (!parent) break;
    currentId = parent.id;
    current = parent;
  }

  return currentId;
}

function findVisibleAncestor(
  windows: Record<string, WindowConfig>,
  windowId: string,
): WindowConfig | null {
  const win = windows[windowId];
  if (!win?.attachedTo?.parentId) return null;

  let currentParentId: string | undefined = win.attachedTo.parentId;

  while (currentParentId) {
    const parentWin: WindowConfig | undefined = windows[currentParentId];
    if (!parentWin) return null;

    if (parentWin.state !== "hidden") {
      return parentWin;
    }

    currentParentId = parentWin.attachedTo?.parentId;
  }

  return null;
}

export function updateAttachedWindowPositions(
  windows: Record<string, WindowConfig>,
  rootId: string,
): void {
  const rootWindow = windows[rootId];
  if (!rootWindow) return;

  const chain = getAttachmentChain(rootId, Object.values(windows));

  const rootX =
    rootWindow.state === "hidden"
      ? (rootWindow.previousPosition?.x ?? rootWindow.position.x)
      : rootWindow.position.x;

  for (const child of chain) {
    if (child.state === "hidden") continue;

    const visibleAncestor = findVisibleAncestor(windows, child.id);

    if (visibleAncestor) {
      child.position = {
        x: rootX,
        y: getWindowBottom(visibleAncestor),
      };
    } else if (rootWindow.state !== "hidden") {
      child.position = {
        x: rootX,
        y: getWindowBottom(rootWindow),
      };
    } else {
      const rootY = rootWindow.previousPosition?.y ?? rootWindow.position.y;
      child.position = { x: rootX, y: rootY };
    }
  }
}

export function cascadeOnHide(
  windows: Record<string, WindowConfig>,
  hiddenWindowId: string,
): void {
  const rootId = findChainRoot(windows, hiddenWindowId);
  updateAttachedWindowPositions(windows, rootId);
}

export function cascadeOnRestore(
  windows: Record<string, WindowConfig>,
  restoredWindowId: string,
): void {
  const rootId = findChainRoot(windows, restoredWindowId);
  updateAttachedWindowPositions(windows, rootId);
}
