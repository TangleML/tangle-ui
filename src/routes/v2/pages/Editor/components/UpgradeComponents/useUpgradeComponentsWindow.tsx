import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { UpgradeComponentsContent } from "./UpgradeComponentsContent";

const WINDOW_ID = "upgrade-components";

export function useUpgradeComponentsWindow() {
  const { windows } = useSharedStores();

  const openUpgradeWindow = () => {
    windows.openWindow(<UpgradeComponentsContent />, {
      id: WINDOW_ID,
      title: "Upgrade Components",
      size: { width: 720, height: 480 },
      minSize: { width: 600, height: 300 },
      startVisible: true,
    });
  };

  return openUpgradeWindow;
}
