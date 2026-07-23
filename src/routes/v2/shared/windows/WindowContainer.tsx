import { observer } from "mobx-react-lite";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { Window } from "./Window";

/**
 * Container component that renders floating (undocked) windows.
 * Docked windows are rendered by their respective DockArea components.
 */
interface WindowContainerProps {
  excludedWindowIds?: ReadonlySet<string>;
}

export const WindowContainer = observer(function WindowContainer({
  excludedWindowIds,
}: WindowContainerProps) {
  const { windows } = useSharedStores();
  return (
    <>
      {windows
        .getFloatingWindowIds()
        .filter((windowId) => !excludedWindowIds?.has(windowId))
        .map((windowId) => (
          <Window key={windowId} windowId={windowId} />
        ))}
    </>
  );
});
