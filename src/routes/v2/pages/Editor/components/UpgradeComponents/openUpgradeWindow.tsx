import { openWindow } from "@/routes/v2/shared/windows/windows.actions";

import { UpgradeComponentsContent } from "./UpgradeComponentsContent";

const WINDOW_ID = "upgrade-components";

export function openUpgradeComponentsWindow() {
  openWindow(<UpgradeComponentsContent />, {
    id: WINDOW_ID,
    title: "Upgrade Components",
    size: { width: 720, height: 480 },
    minSize: { width: 600, height: 300 },
    startVisible: true,
  });
}
