import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

export const PROJECT_DOCK_WINDOW_IDS = [
  "tangent-project-details",
  "tangent-project-sessions",
  "tangent-project-agents",
  "tangent-project-assets",
  "tangent-project-resources",
] as const;

export const rememberedDockWindows = (
  store: WindowStoreImpl,
): ReadonlySet<string> => new Set(store.dockAreas.left.windowOrder);

/**
 * A saved layout has nothing to say about a window added after it was written,
 * so opening that window appends it to the dock — the project window turned up
 * underneath everything rather than above the sessions.
 *
 * `remembered` is the dock order as it stood before this mount opened anything,
 * which is the only way to tell a genuine newcomer from a window the layout
 * placed: opening either one leaves it sitting in `windowOrder` all the same.
 * Newcomers are moved in front of the first window they are meant to precede,
 * and everything the layout knew about stays where the layout put it, so a
 * stack someone rearranged stays rearranged. Ordering goes through
 * `restoreDockArea` rather than `dockWindow` because that one quietly does
 * nothing until the side's `DockArea` has mounted and enabled it.
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
