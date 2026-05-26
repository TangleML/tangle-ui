import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";

import { useAiChatStore } from "./AiChatStoreContext";
import { ChatInput } from "./components/ChatInput";
import { ChatMessageList } from "./components/ChatMessageList";

export const AiChatContent = observer(function AiChatContent() {
  const aiChat = useAiChatStore();
  const notify = useToastNotification();

  function handleSend(prompt: string) {
    aiChat.sendMessage(prompt, {
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
