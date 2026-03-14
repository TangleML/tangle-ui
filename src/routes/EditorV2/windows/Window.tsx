import { observer } from "mobx-react-lite";

import { DockedWindow } from "./components/DockedWindow";
import { FloatingWindow } from "./components/FloatingWindow";
import { getWindowById } from "./windows.actions";

interface WindowProps {
  windowId: string;
  docked?: boolean;
}

export const Window = observer(function Window({
  windowId,
  docked = false,
}: WindowProps) {
  const windowConfig = getWindowById(windowId);
  if (!windowConfig || windowConfig.state === "hidden") return null;

  if (docked) {
    return <DockedWindow windowId={windowId} />;
  }
  return <FloatingWindow windowId={windowId} />;
});
