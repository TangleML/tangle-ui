import { useEffect } from "react";

import { createEditorToolBridge } from "@/routes/v2/pages/Editor/components/AiChat/toolBridge";
import { invokeAutoLayoutVia } from "@/routes/v2/pages/Editor/components/AiChat/toolBridge/invokeAutoLayoutVia";
import { renamePipelineFileFor } from "@/routes/v2/pages/Editor/hooks/renamePipelineFileFor";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { AiChatContent } from "@/routes/v2/shared/components/AiChat/AiChatContent";
import { createReadOnlyToolBridge } from "@/routes/v2/shared/components/AiChat/toolBridge/readOnlyToolBridge";
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

const SUGGESTED_PROMPTS_READ_ONLY: SuggestedPrompt[] = [
  SUGGESTED_PROMPTS_EDITOR[0],
  {
    label: "Explain this pipeline's inputs and outputs",
    icon: "ArrowLeftRight",
  },
  { label: "Check this pipeline for validation issues", icon: "HeartPulse" },
];

export function useAiChatWindow(
  enabled: boolean,
  { readOnly = false }: { readOnly?: boolean } = {},
) {
  const { windows, keyboard } = useSharedStores();
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
          readOnly
            ? createReadOnlyToolBridge(deps)
            : createEditorToolBridge({
                ...deps,
                undo: editorSession.undo,
                invokeAutoLayout: invokeAutoLayoutVia(keyboard),
                onPipelineRenamed: renamePipelineFileFor(
                  editorSession.autoSave,
                  editorSession.pipelineFile,
                  undefined,
                  deps.assertCurrentDocument,
                ),
              })
        }
        suggestedPrompts={
          readOnly ? SUGGESTED_PROMPTS_READ_ONLY : SUGGESTED_PROMPTS_EDITOR
        }
        includeRecentRuns={!readOnly}
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
  }, [enabled, windows, editorSession, keyboard, readOnly]);
}
