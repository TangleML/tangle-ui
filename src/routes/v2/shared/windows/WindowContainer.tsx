import { observer } from "mobx-react-lite";

import { useSharedStores } from "../store/SharedStoreContext";
import { Window } from "./Window";

/**
 * Container component that renders floating (undocked) windows.
 * Docked windows are rendered by their respective DockArea components.
 */
export const WindowContainer = observer(function WindowContainer() {
  const { windows } = useSharedStores();
  return (
    <>
      {windows.getFloatingWindowIds().map((windowId) => (
        <Window key={windowId} windowId={windowId} />
      ))}
    </>
  );
});
