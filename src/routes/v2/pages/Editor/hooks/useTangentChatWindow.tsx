import { useEffect } from "react";

import { TangentChatWindow } from "@/routes/v2/pages/Editor/components/TangentChat/TangentChatWindow";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

const TANGENT_CHAT_WINDOW_ID = "tangent-embed-chat";

export function useTangentChatWindow(enabled: boolean) {
  const { windows } = useSharedStores();

  useEffect(() => {
    if (!enabled) {
      windows.closeWindow(TANGENT_CHAT_WINDOW_ID);
      return;
    }
    if (windows.getWindowById(TANGENT_CHAT_WINDOW_ID)) return;

    windows.openWindow(<TangentChatWindow />, {
      id: TANGENT_CHAT_WINDOW_ID,
      title: "Tangent",
      position: { x: 100, y: 80 },
      size: { width: 480, height: 640 },
      startVisible: true,
      persisted: true,
      defaultDockState: "right",
      miniContent: (
        <WindowMiniButton
          tooltip="Open Tangent"
          label="Tangent"
          icon="MessageCircle"
        />
      ),
    });
  }, [enabled, windows]);
}
