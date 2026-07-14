import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type {
  ChatMessage as ChatMessageType,
  SuggestedPrompt,
} from "@/routes/v2/shared/components/AiChat/types";

import { ChatMessage } from "./ChatMessage";
import { ThinkingMessage } from "./ThinkingMessage";

interface ChatMessageListProps {
  messages: ChatMessageType[];
  thinkingText?: string | null;
  suggestedPrompts?: SuggestedPrompt[];
  onSelectPrompt?: (prompt: string) => void;
}

export function ChatMessageList({
  messages,
  thinkingText,
  suggestedPrompts,
  onSelectPrompt,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thinkingText]);

  if (messages.length === 0 && !thinkingText) {
    return (
      <BlockStack gap="4" className="flex-1 min-h-0 overflow-y-auto p-3">
        <BlockStack gap="2" align="center" inlineAlign="center">
          <div className="flex size-11 items-center justify-center rounded-full bg-accent">
            <Icon name="Sparkles" size="lg" className="text-muted-foreground" />
          </div>
          <Text weight="semibold">How can I help?</Text>
          <Text size="sm" tone="subdued" className="text-center text-balance">
            Ask about this pipeline, or pick a starting point below.
          </Text>
        </BlockStack>

        {suggestedPrompts && suggestedPrompts.length > 0 && (
          <BlockStack gap="2">
            <Text
              size="xs"
              tone="subdued"
              weight="semibold"
              className="uppercase tracking-wide px-1"
            >
              Try asking
            </Text>
            <BlockStack gap="2" as="ul">
              {suggestedPrompts.map((prompt) => (
                <li key={prompt.label}>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => onSelectPrompt?.(prompt.label)}
                    className="h-auto w-full justify-start gap-2 px-1 py-0.5 text-left font-normal whitespace-normal underline"
                  >
                    <Icon name={prompt.icon} size="sm" className="shrink-0" />
                    <span className="flex-1">{prompt.label}</span>
                  </Button>
                </li>
              ))}
            </BlockStack>
          </BlockStack>
        )}
      </BlockStack>
    );
  }

  return (
    <BlockStack
      gap="2"
      className="flex-1 min-h-0 overflow-y-auto p-3 select-text"
    >
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {thinkingText && <ThinkingMessage text={thinkingText} />}
      <div ref={bottomRef} />
    </BlockStack>
  );
}
