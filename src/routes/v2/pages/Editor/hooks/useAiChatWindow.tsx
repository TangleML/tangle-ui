import { useEffect } from "react";

import { createEditorToolBridge } from "@/routes/v2/pages/Editor/components/AiChat/toolBridge";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { AiChatContent } from "@/routes/v2/shared/components/AiChat/AiChatContent";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

const AI_CHAT_WINDOW_ID = "ai-assistant-chat";

export function useAiChatWindow(enabled: boolean) {
  const { windows } = useSharedStores();
  const editorSession = useEditorSession();

  useEffect(() => {
    if (!enabled) {
      windows.closeWindow(AI_CHAT_WINDOW_ID);
      return;
    }
    if (windows.getWindowById(AI_CHAT_WINDOW_ID)) return;

    windows.openWindow(
      <AiChatContent
        createBridge={(deps) =>
          createEditorToolBridge({ ...deps, undo: editorSession.undo })
        }
      />,
      {
        id: AI_CHAT_WINDOW_ID,
        title: "AI Assistant",
        position: { x: 100, y: 80 },
        size: { width: 380, height: 520 },
        disabledActions: ["close"],
        persisted: true,
      },
    );
  }, [enabled, windows, editorSession]);
}
