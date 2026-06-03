import { useEffect } from "react";

import { createRunViewToolBridge } from "@/routes/v2/pages/RunView/toolBridge/runViewToolBridge";
import { AiChatContent } from "@/routes/v2/shared/components/AiChat/AiChatContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const AI_CHAT_WINDOW_ID = "run-ai-assistant-chat";

export function useAiChatWindow(enabled: boolean) {
  const { windows } = useSharedStores();

  useEffect(() => {
    if (!enabled) {
      windows.closeWindow(AI_CHAT_WINDOW_ID);
      return;
    }
    if (windows.getWindowById(AI_CHAT_WINDOW_ID)) return;

    windows.openWindow(
      <AiChatContent createBridge={createRunViewToolBridge} />,
      {
        id: AI_CHAT_WINDOW_ID,
        title: "AI Assistant",
        position: { x: 100, y: 80 },
        size: { width: 380, height: 520 },
        disabledActions: ["close"],
        startVisible: true,
        persisted: true,
      },
    );
  }, [enabled, windows]);
}
