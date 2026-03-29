import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { UpgradeComponentsContent } from "./UpgradeComponentsContent";

const WINDOW_ID = "upgrade-components";
const WINDOW_SIZE = { width: 720, height: 480 };

export function useUpgradeComponentsWindow() {
  const { windows, keyboard } = useSharedStores();

  const openUpgradeWindow = () => {
    const position = { x: globalThis.innerWidth - WINDOW_SIZE.width, y: 60 };

    // todo: replace ad-hoc solution with more robust solution
    keyboard.invokeShortcut("focus-mode");

    windows.openWindow(<UpgradeComponentsContent />, {
      id: WINDOW_ID,
      title: "Upgrade Components",
      size: WINDOW_SIZE,
      minSize: { width: 600, height: 300 },
      position,
      startVisible: true,
      onClose: () => keyboard.invokeShortcut("focus-mode"),
    });
  };

  return openUpgradeWindow;
}
