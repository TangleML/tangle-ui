import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import { RUN_EMBEDDED_VIEW_PRESET } from "@/routes/v2/pages/RunView/runViewWindowPresets";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Embedded run view default layout: dock the panels to the right in the order of
 * {@link RUN_EMBEDDED_VIEW_PRESET} and start the right dock collapsed.
 *
 * The embedded run view has no left dock, so Run Tools (which opens on the left
 * by default) must be moved to the right before it is reachable. Docking requires
 * the right side to be enabled, which only happens once `DockArea side="right"`
 * has mounted — so we wait via a reaction until the side is enabled and every
 * target window exists, then apply the layout once. The embedded run view does
 * not persist layout, so this seeds the dock arrangement on every mount.
 */
export function useEmbeddedRunViewInitialDockLayout(): void {
  const { windows } = useSharedStores();
  const seeded = useRef(false);

  useEffect(() => {
    const rightIds = RUN_EMBEDDED_VIEW_PRESET.dockAreas?.right ?? [];

    const applyLayout = () => {
      for (const id of rightIds) {
        const win = windows.getWindowById(id);
        if (win && (win.state === "hidden" || win.isMinimized)) win.restore();
      }
      windows.seedInitialDockLayoutFromPreset(RUN_EMBEDDED_VIEW_PRESET);
      windows.setDockAreaCollapsed("right", true);
    };

    return reaction(
      () =>
        windows.isDockSideEnabled("right") &&
        rightIds.every((id) => windows.getWindowById(id)),
      (ready) => {
        if (!ready || seeded.current) return;
        applyLayout();
        seeded.current = true;
      },
      { fireImmediately: true },
    );
  }, [windows]);
}
