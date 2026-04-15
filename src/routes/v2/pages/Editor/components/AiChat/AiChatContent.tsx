import { useQueryClient } from "@tanstack/react-query";
import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { PipelineRun } from "@/types/pipelineRun";

import { useAiChatStore } from "./AiChatStoreContext";
import { ChatInput } from "./components/ChatInput";
import { ChatMessageList } from "./components/ChatMessageList";
import { serializeSpecForAi } from "./serializeSpecForAi";
import { useProcessCommands } from "./useProcessCommands";

const MAX_RECENT_RUNS = 5;

export const AiChatContent = observer(function AiChatContent() {
  const { editor, navigation } = useSharedStores();
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
