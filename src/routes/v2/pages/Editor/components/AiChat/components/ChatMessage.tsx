import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/routes/v2/pages/Editor/components/AiChat/aiChat.types";

import { CommandSummary } from "./CommandSummary";
import { renderMarkdown } from "./renderMarkdown";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg px-3 py-2 max-w-[85%] min-w-0",
        isUser
          ? "self-end bg-primary text-primary-foreground"
          : "self-start bg-muted",
      )}
    >
      {isUser ? (
        <Text size="sm" className="text-primary-foreground break-words">
          {message.content}
        </Text>
      ) : (
        <>
          <div className="text-sm text-foreground break-words min-w-0 overflow-x-auto">
            {renderMarkdown(message.content, message.componentReferences)}
          </div>
          {message.commands && message.commands.length > 0 && (
            <CommandSummary commands={message.commands} />
          )}
        </>
      )}
    </div>
  );
}
