import { useEffect, useRef } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ChatMessage as ChatMessageType } from "@/routes/v2/pages/Editor/components/AiChat/aiChat.types";

import { ChatMessage } from "./ChatMessage";
import { ThinkingMessage } from "./ThinkingMessage";

interface ChatMessageListProps {
  messages: ChatMessageType[];
  thinkingText?: string | null;
}

export function ChatMessageList({
  messages,
  thinkingText,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thinkingText]);

  if (messages.length === 0 && !thinkingText) {
    return (
      <BlockStack className="flex-1 items-center justify-center p-4">
        <Text size="sm" tone="subdued">
          Ask anything about your pipeline
        </Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="2" className="flex-1 overflow-y-auto p-3">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {thinkingText && <ThinkingMessage text={thinkingText} />}
      <div ref={bottomRef} />
    </BlockStack>
  );
}
