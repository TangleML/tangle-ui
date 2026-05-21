import { useQueryClient } from "@tanstack/react-query";
import { observer } from "mobx-react-lite";

import type { RecentPipelineRun } from "@/agent/session";
import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { PipelineRun } from "@/types/pipelineRun";

import { isWorkerRuntimeEnabled } from "./aiChatStore";
import { useAiChatStore } from "./AiChatStoreContext";
import { ChatInput } from "./components/ChatInput";
import { ChatMessageList } from "./components/ChatMessageList";
import { serializeSpecForAi } from "./serializeSpecForAi";
import { useProcessCommands } from "./useProcessCommands";

const MAX_RECENT_RUNS = 5;

function toAgentRecentRuns(runs: PipelineRun[]): RecentPipelineRun[] {
  return runs.map((r) => ({
    id: String(r.id),
    root_execution_id: String(r.root_execution_id),
    created_at: r.created_at,
    created_by: r.created_by,
    pipeline_name: r.pipeline_name,
    status: r.status,
  }));
}

export const AiChatContent = observer(function AiChatContent() {
  const { editor, navigation } = useSharedStores();
  const editorSession = useEditorSession();
  const aiChat = useAiChatStore();
  const { createSession } = useProcessCommands();
  const notify = useToastNotification();
  const queryClient = useQueryClient();

  const rootSpec = navigation.rootSpec;
  const currentSpec = rootSpec ? serializeSpecForAi(rootSpec) : null;
  const selectedEntityId = editor.selectedNodeId;

  function handleSend(prompt: string) {
    const cachedRuns =
      queryClient.getQueryData<PipelineRun[]>([
        "pipelineRuns",
        rootSpec?.name,
      ]) ?? [];
    const recentRuns = cachedRuns.slice(0, MAX_RECENT_RUNS);

    if (isWorkerRuntimeEnabled()) {
      aiChat.sendMessageViaWorker(prompt, {
        selectedEntityId,
        recentRuns: toAgentRecentRuns(recentRuns),
        getSpec: () => navigation.rootSpec,
        undo: editorSession.undo,
        onError: (msg) => notify(msg, "error"),
      });
      return;
    }

    const session = createSession();
    aiChat.sendMessage(prompt, {
      currentSpec,
      selectedEntityId,
      recentRuns,
      processCommand: (cmd) => {
        if (rootSpec) session.processCommand(rootSpec, cmd);
      },
      onError: (msg) => notify(msg, "error"),
    });
  }

  return (
    <BlockStack className="h-full" gap="0">
      <ChatMessageList
        messages={aiChat.messages}
        thinkingText={aiChat.thinkingText}
      />
      <ChatInput isPending={aiChat.isPending} onSubmit={handleSend} />
    </BlockStack>
  );
});
