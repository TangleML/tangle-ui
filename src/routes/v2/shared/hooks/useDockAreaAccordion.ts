import { useEffect } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/** Enables accordion behavior on the right dock area (only one window expanded at a time). */
export function useDockAreaAccordion() {
  const { windows } = useSharedStores();
  useEffect(() => {
    return windows.enableDockAreaAccordion("right");
  }, [windows]);
}
