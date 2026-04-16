import { useEffect } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { initDockAreaAccordion } from "@/routes/v2/shared/windows/plugins/dockAreaAccordion";

/** Enables accordion behavior on the right dock area (only one window expanded at a time). */
export function useDockAreaAccordion() {
  const { windows } = useSharedStores();
  useEffect(() => {
    const cleanup = initDockAreaAccordion("right", windows);
    return cleanup;
  }, [windows]);
}
