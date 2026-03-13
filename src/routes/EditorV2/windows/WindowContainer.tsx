import { observer } from "mobx-react-lite";

import { Window } from "./Window";
import { windowStore } from "./windowStore";

/**
 * Container component that renders floating (undocked) windows.
 * Docked windows are rendered by their respective DockArea components.
 */
export const WindowContainer = observer(function WindowContainer() {
  return (
    <>
      {windowStore.windowOrder.map((windowId) => {
        const win = windowStore.windows[windowId];
        if (!win || win.dockState !== "none") return null;
        return <Window key={windowId} windowId={windowId} />;
      })}
    </>
  );
});
