import { useEffect } from "react";

import { RUN_AI_ASSISTANT_WINDOW_ID } from "@/routes/v2/pages/RunView/runViewWindowPresets";
import { createRunViewToolBridge } from "@/routes/v2/pages/RunView/toolBridge/runViewToolBridge";
import { AiChatContent } from "@/routes/v2/shared/components/AiChat/AiChatContent";
import type { SuggestedPrompt } from "@/routes/v2/shared/components/AiChat/types";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";

const SUGGESTED_PROMPTS_RUN: SuggestedPrompt[] = [
  { label: "Summarize this run", icon: "FileText" },
  { label: "Why did this run fail?", icon: "CircleAlert" },
  { label: "Which tasks failed and why?", icon: "ListChecks" },
  { label: "Explain the outputs of this run", icon: "ArrowUpFromLine" },
];

export function useAiChatWindow(enabled: boolean) {
  const { windows } = useSharedStores();

  useEffect(() => {
    if (!enabled) {
      windows.closeWindow(RUN_AI_ASSISTANT_WINDOW_ID);
      return;
    }
    if (windows.getWindowById(RUN_AI_ASSISTANT_WINDOW_ID)) return;

    windows.openWindow(
      <AiChatContent
        createBridge={createRunViewToolBridge}
        suggestedPrompts={SUGGESTED_PROMPTS_RUN}
      />,
      {
        id: RUN_AI_ASSISTANT_WINDOW_ID,
        title: "AI Assistant",
        position: { x: 100, y: 80 },
        size: { width: 380, height: 520 },
        disabledActions: ["close"],
        defaultVisible: true,
        defaultDockState: "left",
        persisted: true,
        miniContent: (
          <WindowMiniButton
            tooltip="Open AI Assistant"
            label="AI Assistant"
            icon="Sparkles"
          />
        ),
      },
    );
  }, [enabled, windows]);
}
