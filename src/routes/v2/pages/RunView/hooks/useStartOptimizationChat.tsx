import { useAiChatStore } from "@/routes/v2/shared/components/AiChat/AiChatStoreContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { AI_CHAT_WINDOW_ID } from "./useAiChatWindow";

const OPTIMIZATION_PROMPT = "Suggest optimization scenario for this pipeline";

/**
 * Surfaces the AI Assistant window, starts a fresh chat thread, and
 * queues an optimization prompt for it. The send itself happens inside
 * the chat window (which owns the tool bridge).
 */
export function useStartOptimizationChat() {
  const { windows } = useSharedStores();
  const aiChat = useAiChatStore();

  return function startOptimizationChat() {
    const win = windows.getWindowById(AI_CHAT_WINDOW_ID);
    if (win) {
      if (win.state === "hidden" || win.isMinimized) {
        win.restore();
      } else {
        win.bringToFront();
      }
    }
    aiChat.startThreadWithPrompt(OPTIMIZATION_PROMPT);
  };
}
