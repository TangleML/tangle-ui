import { useQuery } from "@tanstack/react-query";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { getAiToken } from "@/agent/aiTokenStore";
import { config } from "@/agent/config";
import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { useAiChatStore } from "./AiChatStoreContext";
import { AiTokenSetup } from "./components/AiTokenSetup";
import { ChatInput } from "./components/ChatInput";
import { ChatMessageList } from "./components/ChatMessageList";
import { createToolBridge } from "./toolBridge";
import { AiAssistantTokenQueryKeys } from "./types";

export const AiChatContent = observer(function AiChatContent() {
  const aiChat = useAiChatStore();
  const notify = useToastNotification();
  const { navigation } = useSharedStores();
  const editorSession = useEditorSession();
  const { data: token, isPending: isTokenLoading } = useQuery({
    queryKey: AiAssistantTokenQueryKeys.Token(),
    queryFn: getAiToken,
    staleTime: Infinity,
  });

  // The bridge closes over the navigation + undo stores, so a single
  // instance per AiChatContent mount is correct: each call re-reads
  // `navigation.rootSpec` and the active path lazily, picking up any
  // navigation change without rebuilding the bridge.
  const [bridge] = useState(() =>
    createToolBridge({
      getSpec: () => navigation.rootSpec,
      getActiveSubgraphPath: () =>
        navigation.navigationPath.slice(1).map((e) => e.displayName),
      undo: editorSession.undo,
    }),
  );

  function handleSend(prompt: string) {
    aiChat.sendMessage(prompt, {
      onError: (msg) => notify(msg, "error"),
      bridge,
    });
  }

  if (isTokenLoading) return null;

  const needsToken = token == null && config.proxyMode === "browser-direct";
  if (needsToken) {
    return <AiTokenSetup />;
  }

  return (
    <BlockStack fill>
      <ChatMessageList
        messages={aiChat.messages}
        thinkingText={aiChat.thinkingText}
      />
      <ChatInput isPending={aiChat.isPending} onSubmit={handleSend} />
    </BlockStack>
  );
});
