import { useEffect } from "react";

import { initDockAreaAccordion } from "@/routes/EditorV2/windows/plugins/dockAreaAccordion";

/** Enables accordion behavior on the right dock area (only one window expanded at a time). */
export function useDockAreaAccordion() {
  useEffect(() => {
    const cleanup = initDockAreaAccordion("right");
    return cleanup;
  }, []);
}
