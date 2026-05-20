import { useEffect } from "react";

import { TipOfTheDay } from "@/components/Learn/TipOfTheDay";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const TIP_OF_THE_DAY_WINDOW_ID = "tip-of-the-day";

export function useTipOfTheDayWindow() {
  const { windows } = useSharedStores();
  useEffect(() => {
    if (windows.getWindowById(TIP_OF_THE_DAY_WINDOW_ID)) return;
    windows.openWindow(<TipOfTheDay variant="compact" />, {
      id: TIP_OF_THE_DAY_WINDOW_ID,
      title: "Tip of the Day",
      position: { x: 0, y: 820 },
      size: { width: 280, height: 240 },
      persisted: true,
      defaultDockState: "left",
    });
  }, [windows]);
}
