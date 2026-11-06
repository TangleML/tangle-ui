import { reaction } from "mobx";
import { useEffect, useRef } from "react";

import { narrowLayoutWidth } from "@/routes/v2/pages/Tangent/layout";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Only a collapse this hook performed is undone: someone who collapsed the dock
 * themselves and then widened the window meant to keep it collapsed, and
 * reopening it under them reads as the app fighting the mouse.
 */
export function useNarrowLayoutDock(workareaCollapsed = false) {
  const { windows } = useSharedStores();
  const collapsedByUs = useRef(false);

  // Once the dock is open again, by this hook or by hand, any later collapse
  // is no longer ours to undo.
  useEffect(
    () =>
      reaction(
        () => windows.getDockAreaConfig("left").collapsed,
        (collapsed) => {
          if (!collapsed) collapsedByUs.current = false;
        },
      ),
    [windows],
  );

  useEffect(() => {
    const apply = () => {
      const narrow = window.innerWidth < narrowLayoutWidth(workareaCollapsed);
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
  }, [windows, workareaCollapsed]);
}
