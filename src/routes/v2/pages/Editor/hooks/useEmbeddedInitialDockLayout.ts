import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import {
  EMBEDDED_VIEW_PRESET,
  viewPresetForComponentSearchMode,
} from "@/routes/v2/shared/windows/viewPresets";

/**
 * Embedded editor default layout: dock the panels to the right in the order of
 * {@link EMBEDDED_VIEW_PRESET} and start the right dock collapsed.
 *
 * The embedded editor has no left dock, so windows must be moved to the right
 * before they are reachable. Docking requires the right side to be enabled,
 * which only happens once `DockArea side="right"` has mounted — so we wait via a
 * reaction until the side is enabled and every target window exists, then apply
 * the layout once. The embedded editor does not persist layout, so this replaces
 * the persistence-gated seed used by the full editor.
 */
export function useEmbeddedInitialDockLayout(
  componentSearchV2Enabled: boolean,
): void {
  const { windows } = useSharedStores();
  const seeded = useRef(false);

  useEffect(() => {
    const preset = viewPresetForComponentSearchMode(
      EMBEDDED_VIEW_PRESET,
      componentSearchV2Enabled,
    );
    const rightIds = preset.dockAreas?.right ?? [];

    const applyLayout = () => {
      for (const id of rightIds) {
        const win = windows.getWindowById(id);
        if (win && (win.state === "hidden" || win.isMinimized)) win.restore();
      }
      windows.seedInitialDockLayoutFromPreset(preset);
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
  }, [windows, componentSearchV2Enabled]);
}
