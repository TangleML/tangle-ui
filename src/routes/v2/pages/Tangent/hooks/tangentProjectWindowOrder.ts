import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

export const PROJECT_DETAILS_WINDOW_ID = "tangent-project-details";

export const PROJECT_DOCK_WINDOW_IDS = [
  PROJECT_DETAILS_WINDOW_ID,
  "tangent-project-sessions",
  "tangent-project-agents",
  "tangent-project-assets",
  "tangent-project-resources",
  "tangent-project-runs",
] as const;

export const rememberedDockWindows = (
  store: WindowStoreImpl,
): ReadonlySet<string> => new Set(store.dockAreas.left.windowOrder);

/**
 * A saved layout says nothing about a window added after it was written, so
 * opening that window appends it to the dock — which put the project window
 * underneath everything rather than above the sessions.
 *
 * `remembered` is the dock order before this mount opened anything, the only
 * way to tell a genuine newcomer from a window the layout placed: opening
 * either leaves it in `windowOrder` all the same. Only newcomers are moved, so
 * a stack someone rearranged stays rearranged.
 *
 * Ordering goes through `restoreDockArea` rather than `dockWindow`, which
 * quietly does nothing until the side's `DockArea` has mounted and enabled it.
 */
export function placeProjectDockWindows(
  store: WindowStoreImpl,
  remembered: ReadonlySet<string>,
): void {
  const placing = new Set<string>(
    PROJECT_DOCK_WINDOW_IDS.filter(
      (id) =>
        !remembered.has(id) && store.getWindowById(id)?.dockState === "left",
    ),
  );
  if (placing.size === 0) return;

  const area = store.dockAreas.left;
  const order = area.windowOrder.filter((id) => !placing.has(id));

  PROJECT_DOCK_WINDOW_IDS.forEach((id, rank) => {
    if (!placing.has(id)) return;

    const successors = new Set<string>(PROJECT_DOCK_WINDOW_IDS.slice(rank + 1));
    const before = order.findIndex((other) => successors.has(other));
    order.splice(before === -1 ? order.length : before, 0, id);
  });

  store.restoreDockArea("left", {
    width: area.width,
    collapsed: area.collapsed,
    windowOrder: order,
  });
}
