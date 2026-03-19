import { observer } from "mobx-react-lite";

import { Window } from "./Window";
import { getFloatingWindowIds } from "./windows.actions";

/**
 * Container component that renders floating (undocked) windows.
 * Docked windows are rendered by their respective DockArea components.
 */
export const WindowContainer = observer(function WindowContainer() {
  return (
    <>
      {getFloatingWindowIds().map((windowId) => (
        <Window key={windowId} windowId={windowId} />
      ))}
    </>
  );
});
