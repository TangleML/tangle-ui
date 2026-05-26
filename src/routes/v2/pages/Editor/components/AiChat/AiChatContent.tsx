import { useQuery } from "@tanstack/react-query";
import { observer } from "mobx-react-lite";

import { getAiToken } from "@/agent/aiTokenStore";
import { config } from "@/agent/config";
import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";

import { AiAssistantTokenQueryKeys } from "./aiChat.types";
import { useAiChatStore } from "./AiChatStoreContext";
import { AiTokenSetup } from "./components/AiTokenSetup";
import { ChatInput } from "./components/ChatInput";
import { ChatMessageList } from "./components/ChatMessageList";

export const AiChatContent = observer(function AiChatContent() {
  const aiChat = useAiChatStore();
  const notify = useToastNotification();
  const { data: token, isPending: isTokenLoading } = useQuery({
    queryKey: AiAssistantTokenQueryKeys.Token(),
    queryFn: getAiToken,
    staleTime: Infinity,
  });

  function handleSend(prompt: string) {
    aiChat.sendMessage(prompt, {
      onError: (msg) => notify(msg, "error"),
    });
  }

  if (isTokenLoading) return null;

  const needsToken = token == null && config.proxyMode === "browser-direct";
  if (needsToken) {
    return <AiTokenSetup />;
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
