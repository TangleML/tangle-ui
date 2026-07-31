import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { RUN_AI_ASSISTANT_WINDOW_ID } from "@/routes/v2/pages/RunView/runViewWindowPresets";
import { createRunViewToolBridge } from "@/routes/v2/pages/RunView/toolBridge/runViewToolBridge";
import { AiChatContent } from "@/routes/v2/shared/components/AiChat/AiChatContent";
import type { SuggestedPrompt } from "@/routes/v2/shared/components/AiChat/types";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowMiniButton } from "@/routes/v2/shared/windows/WindowMiniButton";
import {
  flattenExecutionStatusStats,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";

const SUMMARIZE_PROMPT: SuggestedPrompt = {
  label: "Summarize this run",
  icon: "FileText",
};

const FAILED_STATUSES = new Set(["FAILED", "SYSTEM_ERROR", "INVALID"]);
const IN_PROGRESS_STATUSES = new Set([
  "RUNNING",
  "PENDING",
  "QUEUED",
  "WAITING_FOR_UPSTREAM",
  "CANCELLING",
  "UNINITIALIZED",
]);

function getRunSuggestedPrompts(status: string | undefined): SuggestedPrompt[] {
  if (status && FAILED_STATUSES.has(status)) {
    return [
      SUMMARIZE_PROMPT,
      { label: "Why did this run fail?", icon: "CircleAlert" },
      { label: "Which tasks failed and why?", icon: "ListChecks" },
    ];
  }

  if (status && IN_PROGRESS_STATUSES.has(status)) {
    return [
      SUMMARIZE_PROMPT,
      { label: "What's happening in this run right now?", icon: "Activity" },
      { label: "Which tasks are still running?", icon: "LoaderCircle" },
    ];
  }

  return [
    SUMMARIZE_PROMPT,
    { label: "Explain the outputs of this run", icon: "ArrowUpFromLine" },
    { label: "Did anything unexpected happen?", icon: "Search" },
  ];
}

const RunAiChatContent = observer(function RunAiChatContent() {
  const executionData = useExecutionDataOptional();

  const stats =
    executionData?.metadata?.execution_status_stats ??
    flattenExecutionStatusStats(
      executionData?.rootState?.child_execution_status_stats,
    );
  const overallStatus = getOverallExecutionStatusFromStats(stats);

  return (
    <AiChatContent
      createBridge={createRunViewToolBridge}
      suggestedPrompts={getRunSuggestedPrompts(overallStatus)}
    />
  );
});

export function useAiChatWindow(enabled: boolean) {
  const { windows } = useSharedStores();

  useEffect(() => {
    if (!enabled) {
      windows.closeWindow(RUN_AI_ASSISTANT_WINDOW_ID);
      return;
    }
    if (windows.getWindowById(RUN_AI_ASSISTANT_WINDOW_ID)) return;

    windows.openWindow(<RunAiChatContent />, {
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
    });
  }, [enabled, windows]);
}
