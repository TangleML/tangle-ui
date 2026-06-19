import { Text } from "@/components/ui/typography";
import type { ChatMessage as ChatMessageType } from "@/routes/v2/shared/components/AiChat/types";

import { MessageBubble } from "./MessageBubble";
import { renderMarkdown } from "./renderMarkdown";
import { ResponseFeedback } from "./ResponseFeedback";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <MessageBubble variant={isUser ? "user" : "assistant"} gap="1">
      {isUser ? (
        <Text size="sm" className="break-words">
          {message.content}
        </Text>
      ) : (
        <>
          <div className="text-sm break-words min-w-0 overflow-x-auto">
            {renderMarkdown(message.content, message.componentReferences)}
          </div>
          <ResponseFeedback
            prompt={message.prompt}
            response={message.content}
          />
        </>
      )}
    </MessageBubble>
  );
}
