import { useSnapshot } from "valtio";

import { Window } from "./Window";
import { windowStore } from "./windowStore";

/**
 * Container component that renders all active windows from the store.
 * Should be placed in the EditorV2 layout to enable the windows system.
 */
export function WindowContainer() {
  const snap = useSnapshot(windowStore);

  return (
    <>
      {snap.windowOrder.map((windowId) => (
        <Window key={windowId} windowId={windowId} />
      ))}
    </>
  );
}

