import { observer } from "mobx-react-lite";

import { useSharedStores } from "../store/SharedStoreContext";
import { DockedWindow } from "./components/DockedWindow";
import { FloatingWindow } from "./components/FloatingWindow";
import { WindowContextProvider } from "./ContentWindowStateContext";

interface WindowProps {
  windowId: string;
  docked?: boolean;
}

export const Window = observer(function Window({
  windowId,
  docked = false,
}: WindowProps) {
  const { windows } = useSharedStores();
  const model = windows.getWindowById(windowId);
  if (!model || model.state === "hidden") return null;

  const content = windows.getWindowContent(windowId);

  return (
    <WindowContextProvider value={{ model, content }}>
      {docked ? <DockedWindow /> : <FloatingWindow />}
    </WindowContextProvider>
  );
});
