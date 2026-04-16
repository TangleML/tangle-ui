import { useEffect } from "react";

import { AiChatContent } from "@/routes/v2/pages/Editor/components/AiChat/AiChatContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const AI_CHAT_WINDOW_ID = "ai-chat";

export function useAiChatWindow() {
  const { windows } = useSharedStores();

  useEffect(() => {
    if (windows.getWindowById(AI_CHAT_WINDOW_ID)) return;

    windows.openWindow(<AiChatContent />, {
      id: AI_CHAT_WINDOW_ID,
      title: "AI Assistant",
      position: { x: 100, y: 80 },
      size: { width: 380, height: 520 },
      disabledActions: ["close"],
      persisted: true,
    });
  }, [windows]);
}
