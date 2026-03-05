import { useSnapshot } from "valtio";

import { Window } from "./Window";
import { windowStore } from "./windowStore";

/**
 * Container component that renders floating (undocked) windows.
 * Docked windows are rendered by their respective DockArea components.
 */
export function WindowContainer() {
  const snap = useSnapshot(windowStore);

  return (
    <>
      {snap.windowOrder.map((windowId) => {
        const win = snap.windows[windowId];
        if (!win || win.dockState !== "none") return null;
        return <Window key={windowId} windowId={windowId} />;
      })}
    </>
  );
}
