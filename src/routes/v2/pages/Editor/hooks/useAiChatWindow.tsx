import { useEffect } from "react";

import { createEditorToolBridge } from "@/routes/v2/pages/Editor/components/AiChat/toolBridge";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { AiChatContent } from "@/routes/v2/shared/components/AiChat/AiChatContent";
import type { SuggestedPrompt } from "@/routes/v2/shared/components/AiChat/types";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

const AI_CHAT_WINDOW_ID = "ai-assistant-chat";

const SUGGESTED_PROMPTS_EDITOR: SuggestedPrompt[] = [
  { label: "Explain what this pipeline does", icon: "FileText" },
  { label: "Find a component I can add", icon: "Search" },
  { label: "Fix validation issues on this pipeline", icon: "HeartPulse" },
  {
    label: "Fix the latest failed run of this pipeline",
    icon: "Wrench",
  },
];

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
        suggestedPrompts={SUGGESTED_PROMPTS_EDITOR}
      />,
      {
        id: AI_CHAT_WINDOW_ID,
        title: "Sidekick",
        position: { x: 100, y: 80 },
        size: { width: 380, height: 520 },
        disabledActions: ["close"],
        startVisible: true,
        persisted: true,
        defaultDockState: "left",
        miniContent: (
          <WindowMiniButton
            tooltip="Open Sidekick"
            label="Sidekick"
            icon="Sparkles"
          />
        ),
      },
    );
  }, [enabled, windows, editorSession]);
}
