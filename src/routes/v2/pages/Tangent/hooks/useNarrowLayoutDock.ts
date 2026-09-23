import { useEffect, useRef } from "react";

import { NARROW_LAYOUT_WIDTH } from "@/routes/v2/pages/Tangent/layout";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Collapses the left dock to its icon rail while the window is too narrow for
 * three columns, and restores it on the way back out.
 *
 * Only a collapse this hook performed is undone: someone who collapsed the dock
 * themselves and then widened the window meant to keep it collapsed, and
 * reopening it under them would read as the app fighting the mouse.
 */
export function useNarrowLayoutDock() {
  const { windows } = useSharedStores();
  const collapsedByUs = useRef(false);

  useEffect(() => {
    const apply = () => {
      const narrow = window.innerWidth < NARROW_LAYOUT_WIDTH;
      const { collapsed } = windows.getDockAreaConfig("left");

      if (narrow && !collapsed) {
        collapsedByUs.current = true;
        windows.setDockAreaCollapsed("left", true);
        return;
      }
      if (!narrow && collapsed && collapsedByUs.current) {
        collapsedByUs.current = false;
        windows.setDockAreaCollapsed("left", false);
      }
    };

    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [windows]);
}
